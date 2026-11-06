import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES } from '../acceso/permisos';
import { errorCombinacionRoles } from '../acceso/roles-usuario';
import { OtorgarRolExtraDto } from './dto/rol-temporal.dto';

/** Cuánto vale un rol extra: el 'hasta' ya pasó o no es una fecha válida. */
export function parsearHasta(valor: string | undefined, ahora: Date): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha de fin no es válida' });
  }
  if (d.getTime() <= ahora.getTime()) {
    throw new BadRequestException({ codigo: 'FECHA_PASADA', mensaje: 'La fecha de fin ya pasó' });
  }
  return d;
}

/**
 * Roles extra (rol temporal o permanente) de una cuenta. Solo el ADMIN los otorga y los quita;
 * cada otorgamiento, retiro o vencimiento queda en user_account_rol_historial (inmutable) y en auditoría.
 */
@Injectable()
export class UsuariosRolesService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ponytail: un temporizador por instancia; el cierre es idempotente (deleteMany condicionado) y la vigencia ya se filtra al leer
  onModuleInit() {
    this.timer = setInterval(() => {
      this.cerrarRolesVencidos().catch(() => undefined);
    }, 5 * 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private exigirAdmin(actor?: UsuarioAutenticado): void {
    if (actor?.rol !== 'ADMIN') {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo un administrador puede dar o quitar roles' });
    }
  }

  /**
   * Anota como VENCIDO los roles extra cuya fecha ya pasó y los quita de la cuenta. Idempotente:
   * si dos peticiones lo hacen a la vez, solo una anota cada vencimiento.
   */
  async cerrarRolesVencidos(ahora = new Date()): Promise<number> {
    const vencidos = await this.prisma.userAccountRol.findMany({
      where: { vence_en: { lte: ahora } },
    });
    let cerrados = 0;
    for (const v of vencidos) {
      const cerrado = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.userAccountRol.deleteMany({
          where: { user_account_id: v.user_account_id, rol: v.rol, vence_en: { lte: ahora } },
        });
        if (count === 0) return false;
        await tx.userAccountRolHistorial.create({
          data: {
            user_account_id: v.user_account_id,
            rol: v.rol,
            accion: 'VENCIDO',
            quien_party_id: null,
            desde: v.otorgado_en,
            hasta: v.vence_en,
            motivo: v.motivo,
          },
        });
        return true;
      });
      if (cerrado) {
        cerrados++;
        await this.auditoria.registrar({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'ROL_VENCIDO',
          resultado: 'OK',
          entidad: 'user_account',
          entidadId: v.user_account_id,
          antes: { rol: v.rol },
          despues: { venceEn: v.vence_en?.toISOString() ?? null },
          motivo: 'Vencimiento automático del rol temporal',
        });
      }
    }
    return cerrados;
  }

  async otorgar(id: bigint | string | number, dto: OtorgarRolExtraDto, actor?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(actor);
    await this.cerrarRolesVencidos();
    const ahora = new Date();
    const cuenta = await this.prisma.userAccount.findUnique({
      where: { id: BigInt(id) },
      include: { rolesExtra: true },
    });
    if (!cuenta) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    }
    if (actor && cuenta.party_id === actor.partyId) {
      throw new ForbiddenException({ codigo: 'AUTO_ROL', mensaje: 'Nadie puede darse roles a sí mismo' });
    }
    if (!cuenta.activo) {
      throw new ConflictException({ codigo: 'USUARIO_DESACTIVADO', mensaje: 'Reactiva al usuario antes de darle un rol' });
    }
    const rol = dto.rol.trim();
    if (!ROLES.some((r) => r.codigo === rol)) {
      throw new BadRequestException({ codigo: 'ROL_INVALIDO', mensaje: `El rol ${rol} no existe` });
    }
    const extrasActuales = cuenta.rolesExtra.map((r) => r.rol);
    if (extrasActuales.includes(rol) || cuenta.rol === rol) {
      throw new ConflictException({ codigo: 'ROL_YA_ASIGNADO', mensaje: 'La persona ya tiene ese rol' });
    }
    const error = errorCombinacionRoles(cuenta.rol, [...extrasActuales, rol]);
    if (error) {
      throw new BadRequestException({ codigo: 'ROLES_INVALIDOS', mensaje: error });
    }
    const hasta = parsearHasta(dto.hasta, ahora);
    const motivo = dto.motivo?.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      await tx.userAccountRol.create({
        data: {
          user_account_id: cuenta.id,
          rol,
          otorgado_por: actor?.partyId ?? null,
          otorgado_en: ahora,
          vence_en: hasta,
          motivo,
        },
      });
      await tx.userAccountRolHistorial.create({
        data: {
          user_account_id: cuenta.id,
          rol,
          accion: 'OTORGADO',
          quien_party_id: actor?.partyId ?? null,
          desde: ahora,
          hasta,
          motivo,
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: hasta ? 'OTORGAR_ROL_TEMPORAL' : 'OTORGAR_ROL',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: cuenta.id,
      despues: { rol, venceEn: hasta?.toISOString() ?? null },
      motivo: motivo ?? undefined,
      partyId: actor?.partyId,
      ip,
    });
    return { ok: true, rol, venceEn: hasta };
  }

  async retirar(id: bigint | string | number, rol: string, actor?: UsuarioAutenticado, ip?: string) {
    this.exigirAdmin(actor);
    await this.cerrarRolesVencidos();
    const cuentaId = BigInt(id);
    const cuenta = await this.prisma.userAccount.findUnique({ where: { id: cuentaId }, select: { party_id: true } });
    if (!cuenta) {
      throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    }
    if (actor && cuenta.party_id === actor.partyId) {
      throw new ForbiddenException({ codigo: 'AUTO_ROL', mensaje: 'Nadie puede quitarse roles a sí mismo' });
    }
    const fila = await this.prisma.userAccountRol.findUnique({
      where: { user_account_id_rol: { user_account_id: cuentaId, rol } },
    });
    if (!fila) {
      throw new NotFoundException({ codigo: 'ROL_NO_ASIGNADO', mensaje: 'La persona no tiene ese rol extra' });
    }
    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.userAccountRol.delete({ where: { user_account_id_rol: { user_account_id: cuentaId, rol } } });
      await tx.userAccountRolHistorial.create({
        data: {
          user_account_id: cuentaId,
          rol,
          accion: 'RETIRADO',
          quien_party_id: actor?.partyId ?? null,
          desde: fila.otorgado_en,
          hasta: ahora,
          motivo: fila.motivo,
        },
      });
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'QUITAR_ROL',
      resultado: 'OK',
      entidad: 'user_account',
      entidadId: cuentaId,
      antes: { rol, venceEn: fila.vence_en?.toISOString() ?? null },
      partyId: actor?.partyId,
      ip,
    });
    return { ok: true, rol };
  }
}
