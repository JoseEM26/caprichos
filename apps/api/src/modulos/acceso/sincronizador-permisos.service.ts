import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { PERMISOS } from './permisos';

/**
 * Al arrancar, asegura que existan en la base TODOS los permisos del código y que el rol ADMIN los tenga todos.
 * Los despliegues no corren el seed, así que un permiso nuevo del código quedaba sin fila y hasta el
 * administrador recibía SIN_PERMISO. Solo agrega: nunca quita permisos ni toca los demás roles.
 */
@Injectable()
export class SincronizadorPermisosService implements OnModuleInit {
  private readonly logger = new Logger(SincronizadorPermisosService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.sincronizar();
    } catch (err: any) {
      this.logger.warn(`No se pudieron sincronizar los permisos al arrancar: ${err.message}`);
    }
  }

  async sincronizar(): Promise<{ nuevos: number; vinculadosAdmin: number }> {
    const existentes = await this.prisma.permiso.findMany({ select: { id: true, modulo: true, accion: true } });
    const claves = new Set(existentes.map((p) => `${p.modulo}/${p.accion}`));
    const faltantes = PERMISOS.filter((p) => !claves.has(`${p.modulo}/${p.accion}`));

    if (faltantes.length > 0) {
      await this.prisma.permiso.createMany({
        data: faltantes.map((p) => ({ modulo: p.modulo, accion: p.accion })),
        skipDuplicates: true,
      });
    }

    const todos = await this.prisma.permiso.findMany({ select: { id: true } });
    const admin = await this.prisma.rolPermiso.findMany({ where: { rol: 'ADMIN' }, select: { permiso_id: true } });
    const conAdmin = new Set(admin.map((r) => r.permiso_id.toString()));
    const sinVincular = todos.filter((p) => !conAdmin.has(p.id.toString()));

    if (sinVincular.length > 0) {
      await this.prisma.rolPermiso.createMany({
        data: sinVincular.map((p) => ({ rol: 'ADMIN', permiso_id: p.id })),
        skipDuplicates: true,
      });
    }

    if (faltantes.length > 0 || sinVincular.length > 0) {
      this.logger.log(
        `Permisos sincronizados: ${faltantes.length} nuevos, ${sinVincular.length} vinculados al rol ADMIN.`,
      );
    }
    return { nuevos: faltantes.length, vinculadosAdmin: sinVincular.length };
  }
}
