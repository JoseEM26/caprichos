import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

/** Áreas de cocina que atiende un usuario con rol COCINA. Sin áreas = ve todas. */
@Injectable()
export class UsuariosAreasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private async cuenta(idInput: string | number) {
    let id: bigint;
    try {
      id = BigInt(idInput);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'Identificador de usuario no válido' });
    }
    const cuenta = await this.prisma.userAccount.findUnique({
      where: { id },
      include: { rolesExtra: true, areasCocina: true },
    });
    if (!cuenta) throw new NotFoundException({ codigo: 'USUARIO_NO_ENCONTRADO', mensaje: 'Usuario no encontrado' });
    return cuenta;
  }

  private esCocina(cuenta: { rol: string; rolesExtra: Array<{ rol: string }> }): boolean {
    return [cuenta.rol, ...cuenta.rolesExtra.map((r) => r.rol)].includes('COCINA');
  }

  /** Áreas marcadas y las disponibles (activas), para la casilla de la pantalla de usuario. */
  async leer(idInput: string | number) {
    const cuenta = await this.cuenta(idInput);
    const disponibles = await this.prisma.areaCocina.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
      select: { id: true, nombre: true },
    });
    return {
      usuarioId: cuenta.id.toString(),
      esCocina: this.esCocina(cuenta),
      areaIds: cuenta.areasCocina.map((a) => a.area_id.toString()),
      disponibles: disponibles.map((a) => ({ id: a.id.toString(), nombre: a.nombre })),
      nota: 'Sin áreas marcadas, el usuario de cocina ve todas las áreas.',
    };
  }

  /** Reemplaza las áreas del usuario (lista completa). Solo usuarios con rol COCINA. Su rol no cambia. */
  async guardar(idInput: string | number, areaIds: string[], usuario?: UsuarioAutenticado, ip?: string) {
    const cuenta = await this.cuenta(idInput);
    if (!this.esCocina(cuenta)) {
      throw new BadRequestException({ codigo: 'SOLO_ROL_COCINA', mensaje: 'Las áreas se asignan a usuarios con rol Cocina' });
    }
    const ids = [...new Set(areaIds)].map((x) => {
      if (!/^\d+$/.test(String(x))) {
        throw new BadRequestException({ codigo: 'AREA_INVALIDA', mensaje: 'Área no válida' });
      }
      return BigInt(x);
    });
    if (ids.length > 0) {
      const activas = await this.prisma.areaCocina.findMany({ where: { id: { in: ids }, activo: true }, select: { id: true } });
      if (activas.length !== ids.length) {
        throw new BadRequestException({ codigo: 'AREA_INVALIDA', mensaje: 'Alguna área no existe o está inactiva' });
      }
    }
    const antes = cuenta.areasCocina.map((a) => a.area_id.toString());

    await this.prisma.$transaction([
      this.prisma.userAccountArea.deleteMany({ where: { user_account_id: cuenta.id } }),
      this.prisma.userAccountArea.createMany({
        data: ids.map((area_id) => ({ user_account_id: cuenta.id, area_id })),
      }),
    ]);

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'usuarios',
      accion: 'CAMBIAR_AREAS_COCINA',
      entidad: 'user_account',
      entidadId: cuenta.id,
      partyId: usuario?.partyId,
      antes: { areaIds: antes },
      despues: { areaIds: ids.map((i) => i.toString()) },
      ip,
    });
    return { ok: true, areaIds: ids.map((i) => i.toString()), mensaje: ids.length ? 'Áreas guardadas' : 'Sin áreas: ve todas' };
  }
}

