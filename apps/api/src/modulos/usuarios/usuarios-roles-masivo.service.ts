import { BadRequestException, ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES, ROLES_ELIMINADOS } from '../acceso/permisos';
import { errorCombinacionRoles, vigenciaRolExtra } from '../acceso/roles-usuario';
import { RolesMasivoDto } from './dto/roles-masivo.dto';

const LOTE = 50;

export interface ResultadoRolesMasivo {
  accion: 'agregar' | 'quitar';
  rol: string;
  agregados: number;
  quitados: number;
  /** agregar: ya tenían el rol. quitar: no lo tenían como rol extra. */
  yaTenian: number;
  omitidos: Array<{ usuario: string; usuarioId: string; motivo: string }>;
}

/**
 * Asignación masiva de un rol EXTRA (agregar o quitar) a varias cuentas. Reutiliza user_account_rol y su historial
 * inmutable (mismo modelo que roles-extra) y la regla ADMIN/REPARTIDOR no combinables. Nunca toca el rol principal.
 */
@Injectable()
export class UsuariosRolesMasivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async aplicar(dto: RolesMasivoDto, actor?: UsuarioAutenticado, ip?: string): Promise<ResultadoRolesMasivo> {
    if (actor?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede dar o quitar roles' });
    }
    const rol = (dto.rol ?? '').trim();
    if (!ROLES.some((r) => r.codigo === rol) || ROLES_ELIMINADOS.includes(rol)) {
      throw new BadRequestException({ codigo: 'ROL_INVALIDO', mensaje: `El rol ${rol} no existe` });
    }
    const todos = dto.usuarioIds === 'todos';
    if (!todos && (!Array.isArray(dto.usuarioIds) || dto.usuarioIds.length === 0)) {
      throw new BadRequestException({ codigo: 'SIN_USUARIOS', mensaje: 'Elige al menos un usuario' });
    }
    let ids: bigint[] = [];
    if (!todos) {
      try {
        ids = [...new Set((dto.usuarioIds as string[]).map((i) => String(i)))].map((i) => BigInt(i));
      } catch {
        throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Algún identificador de usuario no es válido' });
      }
    }
    const agregar = dto.accion === 'agregar';
    const ahora = new Date();
    const soloActivos = todos ? dto.soloActivos !== false : false;

    const cuentas = await this.prisma.userAccount.findMany({
      where: { ...(todos ? {} : { id: { in: ids } }), ...(soloActivos ? { activo: true } : {}) },
      include: {
        rolesExtra: { where: { OR: vigenciaRolExtra(ahora) } },
        party: { include: { persona: true } },
      },
      orderBy: { id: 'asc' },
    });
    const adminsActivos = await this.prisma.userAccount.count({ where: { rol: 'ADMIN', activo: true } });

    const res: ResultadoRolesMasivo = { accion: dto.accion, rol, agregados: 0, quitados: 0, yaTenian: 0, omitidos: [] };
    type Cuenta = (typeof cuentas)[number];
    const nombre = (c: Cuenta) =>
      `${c.party?.persona?.nombres ?? ''} ${c.party?.persona?.apellidos ?? ''}`.trim() || `Usuario ${c.id}`;
    const omitir = (c: Cuenta, motivo: string) =>
      res.omitidos.push({ usuario: nombre(c), usuarioId: c.id.toString(), motivo });

    // Ids pedidos que no existen
    for (const id of ids) {
      if (!cuentas.some((c) => c.id === id)) {
        res.omitidos.push({ usuario: `Usuario ${id}`, usuarioId: id.toString(), motivo: 'No existe' });
      }
    }

    const aplicables: Array<{ c: Cuenta; antes: string[]; despues: string[] }> = [];
    for (const c of cuentas) {
      const extras = c.rolesExtra.map((r) => r.rol);
      const antes = [c.rol, ...extras];
      if (actor && c.party_id === actor.partyId) {
        omitir(c, 'Es tu propia cuenta: nadie se da ni se quita roles a sí mismo');
        continue;
      }
      if (agregar) {
        if (!c.activo) {
          omitir(c, 'Está desactivado: reactívalo antes de darle un rol');
          continue;
        }
        if (antes.includes(rol)) {
          res.yaTenian++;
          continue;
        }
        const error = errorCombinacionRoles(c.rol, [...extras, rol]);
        if (error) {
          omitir(c, error);
          continue;
        }
        aplicables.push({ c, antes, despues: [...antes, rol] });
      } else {
        if (c.rol === rol) {
          omitir(
            c,
            rol === 'ADMIN' && adminsActivos <= 1
              ? 'Es el último administrador activo: no se le puede quitar el rol'
              : 'Es su rol principal y quedaría sin rol: cámbialo desde Editar usuario',
          );
          continue;
        }
        if (!extras.includes(rol)) {
          res.yaTenian++;
          continue;
        }
        aplicables.push({ c, antes, despues: antes.filter((r) => r !== rol) });
      }
    }

    const motivo = 'Asignación masiva';
    for (let i = 0; i < aplicables.length; i += LOTE) {
      const lote = aplicables.slice(i, i + LOTE);
      await this.prisma.$transaction(async (tx) => {
        const cuentaIds = lote.map((l) => l.c.id);
        if (agregar) {
          await tx.userAccountRol.createMany({
            data: cuentaIds.map((id) => ({ user_account_id: id, rol, otorgado_por: actor?.partyId ?? null, otorgado_en: ahora, vence_en: null, motivo })),
            skipDuplicates: true,
          });
          await tx.userAccountRolHistorial.createMany({
            data: cuentaIds.map((id) => ({ user_account_id: id, rol, accion: 'OTORGADO', quien_party_id: actor?.partyId ?? null, desde: ahora, hasta: null, motivo })),
          });
        } else {
          await tx.userAccountRol.deleteMany({ where: { user_account_id: { in: cuentaIds }, rol } });
          await tx.userAccountRolHistorial.createMany({
            data: lote.map((l) => ({
              user_account_id: l.c.id,
              rol,
              accion: 'RETIRADO',
              quien_party_id: actor?.partyId ?? null,
              desde: l.c.rolesExtra.find((r) => r.rol === rol)?.otorgado_en ?? ahora,
              hasta: ahora,
              motivo,
            })),
          });
        }
        for (const l of lote) {
          await this.auditoria.registrar(
            {
              categoria: 'CAMBIO',
              modulo: 'usuarios',
              accion: agregar ? 'OTORGAR_ROL' : 'QUITAR_ROL',
              resultado: 'OK',
              entidad: 'user_account',
              entidadId: l.c.id,
              antes: { roles: l.antes },
              despues: { roles: l.despues },
              motivo,
              partyId: actor?.partyId,
              ip,
            },
            tx,
          );
        }
      });
      if (agregar) res.agregados += lote.length;
      else res.quitados += lote.length;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: agregar ? 'ROLES_MASIVO_AGREGAR' : 'ROLES_MASIVO_QUITAR',
      resultado: 'OK',
      despues: { rol, solicitados: todos ? 'todos' : ids.length, agregados: res.agregados, quitados: res.quitados, yaTenian: res.yaTenian, omitidos: res.omitidos.length },
      motivo: 'Asignación masiva de roles',
      partyId: actor?.partyId,
      ip,
    });
    if (res.agregados + res.quitados > 0) this.eventos?.emitirAdmin('usuarios:actualizado', { rol, accion: dto.accion });
    return res;
  }
}
