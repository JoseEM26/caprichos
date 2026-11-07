import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { MATRIZ, PERMISOS, ROLES_ELIMINADOS } from './permisos';

/**
 * Al arrancar, asegura que la base tenga TODOS los permisos del código y que cada rol tenga los que
 * MATRIZ le asigna. Los despliegues no corren el seed, así que un permiso nuevo o un vínculo nuevo de
 * rol (p. ej. REPARTIDOR con repartos/tomar) quedaba sin fila: el rol recibía SIN_PERMISO y la pantalla
 * se veía vacía sin error. Solo agrega, salvo los roles retirados (ROLES_ELIMINADOS): a esos les borra los permisos.
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

  async sincronizar(): Promise<{ nuevos: number; vinculados: number }> {
    // Rol retirado: sin permisos aunque la migración no haya corrido (el rol en sí lo borra la migración)
    await this.prisma.rolPermiso.deleteMany({ where: { rol: { in: [...ROLES_ELIMINADOS] } } });

    const existentes = await this.prisma.permiso.findMany({ select: { id: true, modulo: true, accion: true } });
    const claves = new Set(existentes.map((p) => `${p.modulo}/${p.accion}`));
    const faltantes = PERMISOS.filter((p) => !claves.has(`${p.modulo}/${p.accion}`));

    if (faltantes.length > 0) {
      await this.prisma.permiso.createMany({
        data: faltantes.map((p) => ({ modulo: p.modulo, accion: p.accion })),
        skipDuplicates: true,
      });
    }

    const todos = await this.prisma.permiso.findMany({ select: { id: true, modulo: true, accion: true } });
    const idPorClave = new Map(todos.map((p) => [`${p.modulo}/${p.accion}`, p.id]));
    const vinculos = await this.prisma.rolPermiso.findMany({ select: { rol: true, permiso_id: true } });
    const yaVinculados = new Set(vinculos.map((v) => `${v.rol}|${v.permiso_id.toString()}`));

    const sinVincular: Array<{ rol: string; permiso_id: bigint }> = [];
    for (const [rol, clavesRol] of Object.entries(MATRIZ)) {
      for (const clave of clavesRol) {
        const permisoId = idPorClave.get(clave);
        if (permisoId === undefined) continue;
        if (!yaVinculados.has(`${rol}|${permisoId.toString()}`)) {
          sinVincular.push({ rol, permiso_id: permisoId });
        }
      }
    }

    if (sinVincular.length > 0) {
      await this.prisma.rolPermiso.createMany({ data: sinVincular, skipDuplicates: true });
    }

    if (faltantes.length > 0 || sinVincular.length > 0) {
      this.logger.log(
        `Permisos sincronizados: ${faltantes.length} nuevos, ${sinVincular.length} vínculos rol-permiso agregados.`,
      );
    }
    return { nuevos: faltantes.length, vinculados: sinVincular.length };
  }
}
