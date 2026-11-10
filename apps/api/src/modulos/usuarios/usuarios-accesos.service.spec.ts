import { UsuariosAccesosService } from './usuarios-accesos.service';
import { MATRIZ } from '../acceso/permisos';

const ahora = new Date('2026-11-09T12:00:00Z');
const antes = new Date('2026-11-01T00:00:00Z');
const despues = new Date('2026-12-01T00:00:00Z');

/** El fake aplica el filtro de vigencia como lo haría Prisma, para probar que un vencido no cuenta. */
function vigentes<T extends { vence_en: Date | null }>(filas: T[]) {
  return filas.filter((f) => f.vence_en === null || f.vence_en > ahora);
}

function servicio() {
  const cuenta = (id: number, rol: string, nombres: string, extras: any[], permisos: any[], activo = true) => ({
    id: BigInt(id),
    rol,
    activo,
    party: { persona: { nombres, apellidos: 'X' } },
    rolesExtra: vigentes(extras),
    permisosExtra: vigentes(permisos),
  });
  const cuentas = [
    cuenta(1, 'ADMIN', 'Ana', [], []),
    cuenta(2, 'MOZO', 'Beto', [{ rol: 'CAJERO', vence_en: despues }, { rol: 'COCINA', vence_en: antes }], []),
    cuenta(3, 'COCINA', 'Carla', [], [{ modulo: 'caja', accion: 'ver', vence_en: despues }, { modulo: 'stock', accion: 'ver', vence_en: antes }]),
  ];
  const prisma: any = {
    userAccount: { findMany: jest.fn(async ({ where }: any) => cuentas.filter((c) => where.activo === undefined || c.activo === where.activo)) },
    rolPermiso: {
      findMany: jest.fn(async () => [
        { rol: 'MOZO', permiso: { modulo: 'pedidos', accion: 'ver' } },
        { rol: 'CAJERO', permiso: { modulo: 'caja', accion: 'ver' } },
        { rol: 'COCINA', permiso: { modulo: 'cocina', accion: 'ver' } },
      ]),
    },
  };
  return { svc: new UsuariosAccesosService(prisma), prisma };
}

describe('UsuariosAccesosService', () => {
  it('ADMIN: todos, sin recorrer permisos', async () => {
    const { usuarios } = await servicio().svc.listar(false, ahora);
    expect(usuarios[0]).toMatchObject({ todos: true, permisos: [] });
  });

  it('varios roles: une permisos; el rol extra vencido no cuenta', async () => {
    const { usuarios } = await servicio().svc.listar(false, ahora);
    const beto = usuarios[1];
    expect(beto.roles.map((r) => r.rol)).toEqual(['MOZO', 'CAJERO']);
    expect(beto.roles[1].vence_en).toEqual(despues);
    expect(beto.permisos).toEqual(['caja/ver', 'pedidos/ver']);
  });

  it('permiso extra vigente cuenta y se marca como excepción; el vencido no', async () => {
    const { usuarios } = await servicio().svc.listar(false, ahora);
    const carla = usuarios[2];
    expect(carla.permisos).toEqual(['caja/ver', 'cocina/ver']);
    expect(carla.permisosExtra.map((p) => p.permiso)).toEqual(['caja/ver']);
  });

  it('una consulta por tabla (sin N+1) y no expone datos sensibles', async () => {
    const { svc, prisma } = servicio();
    const r = await svc.listar(true, ahora);
    expect(prisma.userAccount.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.rolPermiso.findMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(r.usuarios[0]).sort()).toEqual(['activo', 'id', 'nombre', 'permisos', 'permisosExtra', 'roles', 'todos']);
  });
});

describe('permiso usuarios/ver_accesos', () => {
  it('solo ADMIN lo tiene', () => {
    expect(MATRIZ.ADMIN).toContain('usuarios/ver_accesos');
    for (const r of Object.keys(MATRIZ).filter((k) => k !== 'ADMIN')) expect(MATRIZ[r]).not.toContain('usuarios/ver_accesos');
  });
});
