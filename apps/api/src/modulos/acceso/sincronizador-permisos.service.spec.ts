import { SincronizadorPermisosService } from './sincronizador-permisos.service';
import { MATRIZ, PERMISOS } from './permisos';

describe('SincronizadorPermisosService', () => {
  const permisosConId = PERMISOS.map((p, i) => ({ id: BigInt(i + 1), modulo: p.modulo, accion: p.accion }));
  const idDe = (clave: string) => permisosConId.find((p) => `${p.modulo}/${p.accion}` === clave)!.id;

  // Vínculos rol-permiso que MATRIZ exige, opcionalmente sin algunos
  const vinculosDeMatriz = (sin: Array<{ rol: string; clave: string }> = []) =>
    Object.entries(MATRIZ).flatMap(([rol, claves]) =>
      claves
        .filter((c) => !sin.some((s) => s.rol === rol && s.clave === c))
        .map((c) => ({ rol, permiso_id: idDe(c) })),
    );

  const armar = (permisos: typeof permisosConId, vinculos: Array<{ rol: string; permiso_id: bigint }>) => {
    const prisma: any = {
      permiso: {
        findMany: jest.fn().mockResolvedValueOnce(permisos).mockResolvedValue(permisosConId),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      rolPermisoAjuste: { findMany: jest.fn().mockResolvedValue([]) },
      rolPermiso: {
        findMany: jest.fn().mockResolvedValue(vinculos),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    return { prisma, servicio: new SincronizadorPermisosService(prisma) };
  };

  it('crea el permiso faltante y lo vincula a los roles que lo traen en MATRIZ', async () => {
    const sinPrimero = permisosConId.slice(1);
    const { prisma, servicio } = armar(sinPrimero, vinculosDeMatriz([{ rol: 'ADMIN', clave: 'usuarios/ver' }]));
    const r = await servicio.sincronizar();
    expect(r.nuevos).toBe(1);
    expect(r.vinculados).toBe(1);
    expect(prisma.permiso.createMany.mock.calls[0][0].data).toEqual([
      { modulo: PERMISOS[0].modulo, accion: PERMISOS[0].accion },
    ]);
    const vinculadosAdmin = prisma.rolPermiso.createMany.mock.calls[0][0].data.filter((d: any) => d.rol === 'ADMIN');
    expect(vinculadosAdmin).toHaveLength(1);
  });

  it('agrega al REPARTIDOR el permiso que le falta (repartos/tomar) sin tocar lo demás', async () => {
    const sin = [{ rol: 'REPARTIDOR', clave: 'repartos/tomar' }];
    const { prisma, servicio } = armar(permisosConId, vinculosDeMatriz(sin));
    const r = await servicio.sincronizar();
    expect(r).toEqual({ nuevos: 0, vinculados: 1 });
    expect(prisma.rolPermiso.createMany).toHaveBeenCalledWith({
      data: [{ rol: 'REPARTIDOR', permiso_id: idDe('repartos/tomar') }],
      skipDuplicates: true,
    });
    expect(prisma.permiso.createMany).not.toHaveBeenCalled();
  });

  it('no hace nada si todo existe y todos los vínculos de MATRIZ están', async () => {
    const { prisma, servicio } = armar(permisosConId, vinculosDeMatriz());
    const r = await servicio.sincronizar();
    expect(r).toEqual({ nuevos: 0, vinculados: 0 });
    expect(prisma.permiso.createMany).not.toHaveBeenCalled();
    expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
  });

  it('borra los permisos del rol eliminado CALLCENTER y nunca lo vincula de nuevo', async () => {
    const { prisma, servicio } = armar(permisosConId, vinculosDeMatriz());
    await servicio.sincronizar();
    expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({ where: { rol: { in: ['CALLCENTER'] } } });
    expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
  });

  it('retira los permisos del código del supervisor de los roles y de la tabla', async () => {
    const { prisma, servicio } = armar(permisosConId, vinculosDeMatriz());
    await servicio.sincronizar();
    const retirados = [
      { modulo: 'supervisor', accion: 'ver_codigo' },
      { modulo: 'supervisor', accion: 'gestionar_codigo' },
    ];
    expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({ where: { permiso: { OR: retirados } } });
    expect(prisma.permiso.deleteMany).toHaveBeenCalledWith({ where: { OR: retirados } });
    expect(PERMISOS.some((p) => p.modulo === 'supervisor')).toBe(false);
  });

  it('quita pedidos/anular a todo rol fuera de los de pedidos (p. ej. ALMACEN)', async () => {
    const { prisma, servicio } = armar(permisosConId, vinculosDeMatriz());
    await servicio.sincronizar();
    expect(prisma.rolPermiso.deleteMany).toHaveBeenCalledWith({
      where: { permiso: { modulo: 'pedidos', accion: 'anular' }, rol: { notIn: ['ADMIN', 'CAJERO', 'SUPERVISOR', 'COCINA', 'MOZO', 'REPARTIDOR', 'APOYO_DELIVERY'] } },
    });
  });

  it('un fallo de base al arrancar no tumba la API', async () => {
    const prisma: any = {
      permiso: { findMany: jest.fn().mockRejectedValue(new Error('sin base')) },
      rolPermiso: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    await expect(new SincronizadorPermisosService(prisma).onModuleInit()).resolves.toBeUndefined();
  });
});
