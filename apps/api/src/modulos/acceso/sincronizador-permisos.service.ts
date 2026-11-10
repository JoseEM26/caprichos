import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { MATRIZ, PERMISOS, PERMISOS_RETIRADOS, ROLES_ANULAN_PEDIDOS, ROLES_ELIMINADOS } from './permisos';

/**
 * Al arrancar, asegura que la base tenga TODOS los permisos del código y que cada rol tenga los que
 * MATRIZ le asigna. Los despliegues no corren el seed, así que un permiso nuevo o un vínculo nuevo de
 * rol (p. ej. REPARTIDOR con repartos/tomar) quedaba sin fila: el rol recibía SIN_PERMISO y la pantalla
 * se veía vacía sin error. Después de la base aplica los AJUSTES del dueño (rol_permiso_ajuste: CONCEDE agrega, QUITA
 * elimina), así un despliegue no pisa lo que él cambió y los permisos nuevos de MATRIZ se suman sin revertir sus QUITA.
 * ADMIN no tiene ajustes (intocable). Solo agrega, salvo los roles retirados (ROLES_ELIMINADOS: les borra los permisos) y los permisos retirados (PERMISOS_RETIRADOS).
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

    // Permiso retirado (p. ej. supervisor/ver_codigo): se quita de todos los roles y de la tabla de permisos
    const retirados = PERMISOS_RETIRADOS.map((c) => {
      const [modulo, accion] = c.split('/');
      return { modulo, accion };
    });
    await this.prisma.rolPermiso.deleteMany({ where: { permiso: { OR: retirados } } });
    await this.prisma.permiso.deleteMany({ where: { OR: retirados } });

    // Anular pedidos: se quita el vínculo a roles fuera de ROLES_ANULAN_PEDIDOS (p. ej. ALMACEN)
    await this.prisma.rolPermiso.deleteMany({
      where: { permiso: { modulo: 'pedidos', accion: 'anular' }, rol: { notIn: [...ROLES_ANULAN_PEDIDOS] } },
    });

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

    // Ajustes del dueño (nunca sobre ADMIN ni sobre permisos retirados)
    const ajustes = (await this.prisma.rolPermisoAjuste.findMany({ select: { rol: true, modulo: true, accion: true, efecto: true } })).filter(
      (a) => a.rol !== 'ADMIN',
    );
    const quita = new Set(ajustes.filter((a) => a.efecto === 'QUITA').map((a) => `${a.rol}|${a.modulo}/${a.accion}`));
    const concede = ajustes.filter((a) => a.efecto === 'CONCEDE').map((a) => ({ rol: a.rol, clave: `${a.modulo}/${a.accion}` }));

    const sinVincular: Array<{ rol: string; permiso_id: bigint }> = [];
    const deseados: Array<{ rol: string; clave: string }> = [
      ...Object.entries(MATRIZ).flatMap(([rol, claves]) => claves.map((clave) => ({ rol, clave }))),
      ...concede,
    ];
    const vistos = new Set<string>();
    for (const { rol, clave } of deseados) {
      if (quita.has(`${rol}|${clave}`) || vistos.has(`${rol}|${clave}`)) continue;
      vistos.add(`${rol}|${clave}`);
      const permisoId = idPorClave.get(clave);
      if (permisoId === undefined) continue;
      if (!yaVinculados.has(`${rol}|${permisoId.toString()}`)) sinVincular.push({ rol, permiso_id: permisoId });
    }

    // QUITA del dueño: se eliminan los vínculos que la base (o un arranque anterior) hubiera dejado
    for (const q of quita) {
      const [rol, clave] = q.split('|');
      const [modulo, accion] = clave.split('/');
      await this.prisma.rolPermiso.deleteMany({ where: { rol, permiso: { modulo, accion } } });
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
