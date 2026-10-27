import { SincronizadorPermisosService } from './sincronizador-permisos.service';
import { PERMISOS } from './permisos';

describe('SincronizadorPermisosService', () => {
  const armar = (existentes: Array<{ id: bigint; modulo: string; accion: string }>, adminIds: bigint[]) => {
    const prisma: any = {
      permiso: {
        findMany: jest.fn().mockResolvedValueOnce(existentes).mockImplementation(async () => [...existentes, { id: 999n }]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      rolPermiso: {
        findMany: jest.fn().mockResolvedValue(adminIds.map((permiso_id) => ({ permiso_id }))),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    return { prisma, servicio: new SincronizadorPermisosService(prisma) };
  };

  it('crea el permiso faltante y lo vincula a ADMIN', async () => {
    const conTodosMenosUno = PERMISOS.slice(1).map((p, i) => ({ id: BigInt(i + 1), modulo: p.modulo, accion: p.accion }));
    const { prisma, servicio } = armar(conTodosMenosUno, conTodosMenosUno.map((p) => p.id));
    const r = await servicio.sincronizar();
    expect(r.nuevos).toBe(1);
    expect(prisma.permiso.createMany.mock.calls[0][0].data).toEqual([
      { modulo: PERMISOS[0].modulo, accion: PERMISOS[0].accion },
    ]);
    expect(prisma.rolPermiso.createMany.mock.calls[0][0].data.every((d: any) => d.rol === 'ADMIN')).toBe(true);
  });

  it('no hace nada si todo existe y ADMIN ya los tiene', async () => {
    const todos = PERMISOS.map((p, i) => ({ id: BigInt(i + 1), modulo: p.modulo, accion: p.accion }));
    const prisma: any = {
      permiso: { findMany: jest.fn().mockResolvedValue(todos), createMany: jest.fn() },
      rolPermiso: { findMany: jest.fn().mockResolvedValue(todos.map((t) => ({ permiso_id: t.id }))), createMany: jest.fn() },
    };
    const r = await new SincronizadorPermisosService(prisma).sincronizar();
    expect(r).toEqual({ nuevos: 0, vinculadosAdmin: 0 });
    expect(prisma.permiso.createMany).not.toHaveBeenCalled();
    expect(prisma.rolPermiso.createMany).not.toHaveBeenCalled();
  });

  it('un fallo de base al arrancar no tumba la API', async () => {
    const prisma: any = { permiso: { findMany: jest.fn().mockRejectedValue(new Error('sin base')) } };
    await expect(new SincronizadorPermisosService(prisma).onModuleInit()).resolves.toBeUndefined();
  });
});
