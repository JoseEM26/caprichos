import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MODULOS_ROL, coincideMinimo, moduloRolVisible, permisosAConceder } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { MATRIZ, PERMISOS, ROLES, ROLES_ELIMINADOS } from '../acceso/permisos';
import type { UsuarioAutenticado } from '../acceso/acceso.tipos';

type Ajuste = { modulo: string; accion: string; efecto: 'CONCEDE' | 'QUITA' };

/** Permisos concretos que ocupa el mínimo de un módulo (para 'repartos' suelto: todos los repartos/…). */
const permisosDelMinimo = (minimo: string) => PERMISOS.map((p) => `${p.modulo}/${p.accion}`).filter((c) => coincideMinimo(c, minimo));
const EDITABLES = MODULOS_ROL.filter((m) => !m.bloqueado);
/** Universo que este servicio gobierna: mínimos de los módulos editables y sus lecturas. Nada más se toca. */
const UNIVERSO = new Set([...EDITABLES.flatMap((m) => permisosDelMinimo(m.minimo)), ...EDITABLES.flatMap((m) => m.lecturas ?? [])]);
const partir = (c: string) => {
  const [modulo, accion] = c.split('/');
  return { modulo, accion };
};

/**
 * Dar o quitar MÓDULOS a un rol (Usuarios › Qué ve cada rol). Solo ADMIN. Se guarda como diferencias contra la base del
 * sistema (MATRIZ) en rol_permiso_ajuste y se aplica a rol_permiso en la misma transacción; el sincronizador de arranque
 * los reaplica después de la base, así un despliegue no los pisa. Los permisos se leen de la base en cada petición y la
 * web los trae al iniciar sesión / recargar: el cambio llega a los conectados en su próxima carga de sesión (sin caché).
 */
@Injectable()
export class UsuariosRolesModulosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private rolEditable(rol: string): void {
    if (rol === 'ADMIN') throw new ForbiddenException({ codigo: 'ADMIN_INTOCABLE', mensaje: 'El administrador siempre ve todo y no se puede cambiar' });
    if (ROLES_ELIMINADOS.includes(rol) || !ROLES.some((r) => r.codigo === rol)) {
      throw new NotFoundException({ codigo: 'ROL_INVALIDO', mensaje: `El rol ${rol} no existe` });
    }
  }

  private estado(permisos: Iterable<string>, base: Set<string>) {
    const lista = [...permisos];
    const visibles = (m: (typeof MODULOS_ROL)[number]) => moduloRolVisible(m, lista);
    return Object.fromEntries(
      MODULOS_ROL.map((m) => {
        const ve = visibles(m);
        return [m.clave, { ve, base: moduloRolVisible(m, base), ajustado: ve !== moduloRolVisible(m, base) }];
      }),
    );
  }

  async listar() {
    const [vinculos, ajustes] = await Promise.all([
      this.prisma.rolPermiso.findMany({ select: { rol: true, permiso: { select: { modulo: true, accion: true } } } }),
      this.prisma.rolPermisoAjuste.findMany({ select: { rol: true } }),
    ]);
    const roles = ROLES.filter((r) => !ROLES_ELIMINADOS.includes(r.codigo)).map((r) => {
      const base = new Set(MATRIZ[r.codigo] ?? []);
      const efectivos = r.codigo === 'ADMIN' ? [...base] : vinculos.filter((v) => v.rol === r.codigo).map((v) => `${v.permiso.modulo}/${v.permiso.accion}`);
      return {
        rol: r.codigo,
        nombre: r.nombre,
        editable: r.codigo !== 'ADMIN',
        ajustes: ajustes.filter((a) => a.rol === r.codigo).length,
        modulos: this.estado(efectivos, base),
      };
    });
    return { catalogo: MODULOS_ROL.map((m) => ({ clave: m.clave, minimo: m.minimo, bloqueado: !!m.bloqueado })), roles };
  }

  /** Calcula las diferencias contra la base para que el rol vea exactamente estos módulos (más sus pares de mínimo). */
  calcularAjustes(rol: string, modulos: string[]): Ajuste[] {
    const base = new Set(MATRIZ[rol] ?? []);
    const quiere = MODULOS_ROL.filter((m) => modulos.includes(m.clave) || m.bloqueado);
    const queda = new Set<string>();
    const conceder = new Set<string>();
    for (const m of quiere) {
      for (const p of permisosDelMinimo(m.minimo)) if (base.has(p)) queda.add(p);
      if (!m.bloqueado && !moduloRolVisible(m, base)) for (const p of permisosAConceder(m)) conceder.add(p);
    }
    const ajustes: Ajuste[] = [];
    for (const p of new Set(EDITABLES.flatMap((m) => permisosDelMinimo(m.minimo)))) {
      if (base.has(p) && !queda.has(p) && !conceder.has(p)) ajustes.push({ ...partir(p), efecto: 'QUITA' });
    }
    for (const p of conceder) if (!base.has(p)) ajustes.push({ ...partir(p), efecto: 'CONCEDE' });
    return ajustes;
  }

  /** Deja rol_permiso = (base − QUITA) + CONCEDE dentro del universo que este servicio gobierna. */
  private async aplicar(tx: any, rol: string, ajustes: Ajuste[]): Promise<void> {
    const base = new Set(MATRIZ[rol] ?? []);
    const quita = new Set(ajustes.filter((a) => a.efecto === 'QUITA').map((a) => `${a.modulo}/${a.accion}`));
    const concede = new Set(ajustes.filter((a) => a.efecto === 'CONCEDE').map((a) => `${a.modulo}/${a.accion}`));
    const permisos: Array<{ id: bigint; modulo: string; accion: string }> = await tx.permiso.findMany({ select: { id: true, modulo: true, accion: true } });
    const debe: bigint[] = [];
    const noDebe: bigint[] = [];
    for (const p of permisos) {
      const c = `${p.modulo}/${p.accion}`;
      if (!UNIVERSO.has(c)) continue;
      ((base.has(c) && !quita.has(c)) || concede.has(c) ? debe : noDebe).push(p.id);
    }
    if (noDebe.length) await tx.rolPermiso.deleteMany({ where: { rol, permiso_id: { in: noDebe } } });
    if (debe.length) await tx.rolPermiso.createMany({ data: debe.map((permiso_id) => ({ rol, permiso_id })), skipDuplicates: true });
  }

  private async efectivosDe(db: any, rol: string): Promise<string[]> {
    const f = await db.rolPermiso.findMany({ where: { rol }, select: { permiso: { select: { modulo: true, accion: true } } } });
    return f.map((x: any) => `${x.permiso.modulo}/${x.permiso.accion}`);
  }

  private async guardar(rol: string, modulos: string[] | null, actor?: UsuarioAutenticado, ip?: string) {
    if (actor?.rol !== 'ADMIN') throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador cambia lo que ve cada rol' });
    this.rolEditable(rol);
    if (modulos) {
      const desconocidos = modulos.filter((c) => !MODULOS_ROL.some((m) => m.clave === c));
      if (desconocidos.length) throw new BadRequestException({ codigo: 'MODULO_INVALIDO', mensaje: `Módulo desconocido: ${desconocidos.join(', ')}` });
    }
    const resultado = await this.prisma.$transaction(async (tx: any) => {
      const antes = await this.efectivosDe(tx, rol);
      if (modulos) {
        // Los módulos obligatorios (marcar asistencia, notificaciones) no cambian: se rechaza si se intenta
        for (const m of MODULOS_ROL.filter((x) => x.bloqueado)) {
          if (modulos.includes(m.clave) !== moduloRolVisible(m, antes)) {
            throw new BadRequestException({ codigo: 'MODULO_BLOQUEADO', mensaje: `El módulo ${m.clave} es obligatorio y no se puede cambiar` });
          }
        }
      }
      const ajustes = modulos ? this.calcularAjustes(rol, modulos) : [];
      await tx.rolPermisoAjuste.deleteMany({ where: { rol } });
      if (ajustes.length) {
        await tx.rolPermisoAjuste.createMany({ data: ajustes.map((a) => ({ rol, ...a, creado_por: actor.partyId ?? null })) });
      }
      await this.aplicar(tx, rol, ajustes);
      const despues = await this.efectivosDe(tx, rol);
      const ve = (p: string[]) => MODULOS_ROL.filter((m) => moduloRolVisible(m, p)).map((m) => m.clave);
      const [a, d] = [ve(antes), ve(despues)];
      const diff = { agregados: d.filter((c) => !a.includes(c)), quitados: a.filter((c) => !d.includes(c)) };
      await this.auditoria.registrar(
        {
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: modulos ? 'ROL_MODULOS_GUARDAR' : 'ROL_MODULOS_RESTABLECER',
          entidad: 'rol',
          antes: { rol, modulos: a },
          despues: { rol, modulos: d, ...diff, ajustes: ajustes.map((x) => `${x.efecto} ${x.modulo}/${x.accion}`) },
          partyId: actor.partyId,
          ip,
        },
        tx,
      );
      return { ok: true, rol, ...diff, ajustes: ajustes.length };
    });
    return resultado;
  }

  guardarModulos(rol: string, modulos: string[], actor?: UsuarioAutenticado, ip?: string) {
    return this.guardar(rol, modulos, actor, ip);
  }

  restablecer(rol: string, actor?: UsuarioAutenticado, ip?: string) {
    return this.guardar(rol, null, actor, ip);
  }
}
