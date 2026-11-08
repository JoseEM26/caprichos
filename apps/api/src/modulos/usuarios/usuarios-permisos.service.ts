import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PERMISOS } from '../acceso/permisos';
import { permisosDeRoles, rolesDeCuenta, vigenciaRolExtra } from '../acceso/roles-usuario';
import { CATALOGO_PERMISOS, esSensible, NOMBRES_MODULO, nombreAccion } from '../acceso/permisos-extra';
import { PermisosExtraDto } from './dto/permisos-extra.dto';

const MAX_VIGENCIA_MS = 366 * 24 * 3600 * 1000;

/** Permisos extra por persona: aditivos a los de sus roles, con vencimiento opcional. Solo el ADMIN otorga o revoca. */
@Injectable()
export class UsuariosPermisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async cuenta(id: bigint | string | number) {
    const c = await this.prisma.userAccount.findUnique({ where: { id: BigInt(id) } });
    if (!c) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    return c;
  }

  private motivoBloqueo(roles: string[]): string | null {
    if (roles.includes('ADMIN')) return 'El Administrador ya tiene todos los permisos';
    if (roles.includes('REPARTIDOR')) return 'El Repartidor no recibe permisos extra: queda aislado de la administración';
    return null;
  }

  /** Roles, permisos por rol, extras vigentes, efectivos y catálogo agrupado por módulo en lenguaje llano. */
  async obtener(id: bigint | string | number) {
    const cuenta = await this.cuenta(id);
    const roles = await rolesDeCuenta(this.prisma, cuenta.id, cuenta.rol);
    const [deRoles, filas] = await Promise.all([
      permisosDeRoles(this.prisma, roles),
      this.prisma.userAccountPermiso.findMany({
        where: { user_account_id: cuenta.id, OR: vigenciaRolExtra() },
        orderBy: [{ modulo: 'asc' }, { accion: 'asc' }],
      }),
    ]);
    const extras = filas.map((f) => ({
      clave: `${f.modulo}/${f.accion}`,
      modulo: f.modulo,
      accion: f.accion,
      venceEn: f.vence_en?.toISOString() ?? null,
      nota: f.nota,
      otorgadoEn: f.otorgado_en.toISOString(),
    }));
    const clavesExtra = new Set(extras.map((e) => e.clave));
    const efectivos = [...new Set([...deRoles, ...clavesExtra])].sort();
    const modulos = new Map<string, { modulo: string; nombre: string; acciones: Array<{ clave: string; accion: string; nombre: string; sensible: boolean; porRol: boolean; extra: boolean }> }>();
    for (const p of PERMISOS) {
      const clave = `${p.modulo}/${p.accion}`;
      const m = modulos.get(p.modulo) ?? { modulo: p.modulo, nombre: NOMBRES_MODULO[p.modulo] ?? p.modulo, acciones: [] };
      m.acciones.push({
        clave,
        accion: p.accion,
        nombre: nombreAccion(p.accion),
        sensible: esSensible(clave),
        porRol: deRoles.includes(clave),
        extra: clavesExtra.has(clave),
      });
      modulos.set(p.modulo, m);
    }
    return {
      rol: cuenta.rol,
      roles,
      bloqueado: this.motivoBloqueo(roles),
      extras,
      efectivos,
      modulos: [...modulos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    };
  }

  /** Reemplaza el conjunto de permisos extra de la persona, valida y audita cada diferencia. */
  async reemplazar(id: bigint | string | number, dto: PermisosExtraDto, actor?: UsuarioAutenticado, ip?: string) {
    if (actor?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede dar o quitar permisos' });
    }
    const cuenta = await this.cuenta(id);
    if (actor && cuenta.party_id === actor.partyId) {
      throw new ForbiddenException({ codigo: 'AUTO_PERMISO', mensaje: 'Nadie puede darse ni quitarse permisos a sí mismo' });
    }
    const roles = await rolesDeCuenta(this.prisma, cuenta.id, cuenta.rol);
    const bloqueo = this.motivoBloqueo(roles);
    if (bloqueo) throw new BadRequestException({ codigo: 'PERMISOS_BLOQUEADOS', mensaje: bloqueo });

    const ahora = new Date();
    const nuevos = new Map<string, { modulo: string; accion: string; vence: Date | null; nota: string | null }>();
    for (const p of dto.permisos) {
      const clave = `${p.modulo}/${p.accion}`;
      if (!CATALOGO_PERMISOS.has(clave)) {
        throw new BadRequestException({ codigo: 'PERMISO_INVALIDO', mensaje: `El permiso ${clave} no existe` });
      }
      if (nuevos.has(clave)) throw new BadRequestException({ codigo: 'PERMISO_REPETIDO', mensaje: `El permiso ${clave} está repetido` });
      let vence: Date | null = null;
      if (p.venceEn) {
        vence = new Date(p.venceEn);
        if (Number.isNaN(vence.getTime()) || vence.getTime() <= ahora.getTime()) {
          throw new BadRequestException({ codigo: 'FECHA_PASADA', mensaje: 'La fecha de fin ya pasó o no es válida' });
        }
        if (vence.getTime() - ahora.getTime() > MAX_VIGENCIA_MS) {
          throw new BadRequestException({ codigo: 'VIGENCIA_EXCESIVA', mensaje: 'Un permiso extra vale como máximo 1 año' });
        }
      }
      nuevos.set(clave, { modulo: p.modulo, accion: p.accion, vence, nota: p.nota?.trim() || null });
    }

    const previos = await this.prisma.userAccountPermiso.findMany({ where: { user_account_id: cuenta.id } });
    const previoPorClave = new Map(previos.filter((f) => !f.vence_en || f.vence_en > ahora).map((f) => [`${f.modulo}/${f.accion}`, f]));
    const iso = (d: Date | null | undefined) => d?.toISOString() ?? null;

    const otorgar: string[] = [];
    const revocar: string[] = [];
    for (const [clave, n] of nuevos) {
      const p = previoPorClave.get(clave);
      if (!p || iso(p.vence_en) !== iso(n.vence) || (p.nota ?? null) !== n.nota) otorgar.push(clave);
    }
    for (const clave of previoPorClave.keys()) if (!nuevos.has(clave)) revocar.push(clave);

    const delicados = otorgar.filter(esSensible);
    if (delicados.length > 0 && dto.confirmacionFuerte !== true) {
      throw new ConflictException({
        codigo: 'CONFIRMACION_FUERTE',
        mensaje: `Estos permisos son delicados y exigen confirmación fuerte: ${delicados.join(', ')}`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Quita los revocados y, de paso, los vencidos (ya no cuentan)
      await tx.userAccountPermiso.deleteMany({
        where: {
          user_account_id: cuenta.id,
          OR: [{ vence_en: { lte: ahora } }, ...revocar.map((c) => ({ modulo: c.split('/')[0], accion: c.split('/')[1] }))],
        },
      });
      for (const clave of otorgar) {
        const n = nuevos.get(clave)!;
        await tx.userAccountPermiso.upsert({
          where: { user_account_id_modulo_accion: { user_account_id: cuenta.id, modulo: n.modulo, accion: n.accion } },
          create: { user_account_id: cuenta.id, modulo: n.modulo, accion: n.accion, otorgado_por: actor?.partyId ?? null, otorgado_en: ahora, vence_en: n.vence, nota: n.nota },
          update: { otorgado_por: actor?.partyId ?? null, otorgado_en: ahora, vence_en: n.vence, nota: n.nota },
        });
      }
    });

    for (const clave of otorgar) {
      const n = nuevos.get(clave)!;
      const p = previoPorClave.get(clave);
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'usuarios',
        accion: 'PERMISO_EXTRA_OTORGADO',
        resultado: 'OK',
        entidad: 'user_account',
        entidadId: cuenta.id,
        antes: p ? { permiso: clave, venceEn: iso(p.vence_en), nota: p.nota } : undefined,
        despues: { permiso: clave, venceEn: iso(n.vence), nota: n.nota, sensible: esSensible(clave) },
        motivo: n.nota ?? undefined,
        partyId: actor?.partyId,
        ip,
      });
    }
    for (const clave of revocar) {
      const p = previoPorClave.get(clave)!;
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'usuarios',
        accion: 'PERMISO_EXTRA_REVOCADO',
        resultado: 'OK',
        entidad: 'user_account',
        entidadId: cuenta.id,
        antes: { permiso: clave, venceEn: iso(p.vence_en), nota: p.nota },
        partyId: actor?.partyId,
        ip,
      });
    }
    return { ok: true, otorgados: otorgar, revocados: revocar, aplicacion: 'Se aplica la próxima vez que la persona entre o recargue' };
  }
}
