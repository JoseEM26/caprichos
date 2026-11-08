jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsuariosRolesMasivoService } from '../usuarios-roles-masivo.service';
import { MATRIZ, ROLES } from '../../acceso/permisos';

const ADMIN = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] } as any;

function cuenta(id: bigint, rol: string, extras: string[] = [], activo = true) {
  return {
    id,
    party_id: id + 100n,
    rol,
    activo,
    rolesExtra: extras.map((e) => ({ rol: e, otorgado_en: new Date('2026-11-01') })),
    party: { persona: { nombres: `N${id}`, apellidos: 'A' } },
  };
}

function montar(cuentas: any[], admins = 2) {
  const tx: any = {
    userAccountRol: { createMany: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({}) },
    userAccountRolHistorial: { createMany: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    userAccount: { findMany: jest.fn().mockResolvedValue(cuentas), count: jest.fn().mockResolvedValue(admins) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const eventos: any = { emitirAdmin: jest.fn() };
  return { svc: new UsuariosRolesMasivoService(prisma, auditoria, eventos), tx, prisma, auditoria, eventos };
}

describe('UsuariosRolesMasivoService', () => {
  it('agrega el rol extra en bloque, con historial, auditoría por usuario y resumen, y avisa', async () => {
    const { svc, tx, auditoria, eventos } = montar([cuenta(10n, 'CAJERO'), cuenta(11n, 'MOZO', ['SUPERVISOR'])]);
    const r = await svc.aplicar({ usuarioIds: ['10', '11'], rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(r).toMatchObject({ agregados: 2, yaTenian: 0, omitidos: [] });
    expect(tx.userAccountRol.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.userAccountRolHistorial.createMany.mock.calls[0][0].data[0]).toMatchObject({ accion: 'OTORGADO', rol: 'APOYO_DELIVERY' });
    const porUsuario = auditoria.registrar.mock.calls.filter((c: any[]) => c[0].entidad === 'user_account');
    expect(porUsuario).toHaveLength(2);
    expect(porUsuario[0][0]).toMatchObject({ antes: { roles: ['CAJERO'] }, despues: { roles: ['CAJERO', 'APOYO_DELIVERY'] } });
    expect(porUsuario[0][1]).toBe(tx);
    expect(auditoria.registrar.mock.calls.some((c: any[]) => c[0].accion === 'ROLES_MASIVO_AGREGAR')).toBe(true);
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('usuarios:actualizado', expect.anything());
  });

  it('es idempotente: quien ya lo tiene (principal o extra) cuenta como yaTenian y no se duplica', async () => {
    const { svc, prisma, tx } = montar([cuenta(10n, 'CAJERO', ['APOYO_DELIVERY']), cuenta(11n, 'APOYO_DELIVERY')]);
    const r = await svc.aplicar({ usuarioIds: ['10', '11'], rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(r).toMatchObject({ agregados: 0, yaTenian: 2 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.userAccountRol.createMany).not.toHaveBeenCalled();
  });

  it('omite con motivo a ADMIN (no se combina) y a REPARTIDOR, sin fallar a los demás', async () => {
    const { svc } = montar([cuenta(10n, 'ADMIN'), cuenta(11n, 'REPARTIDOR'), cuenta(12n, 'MOZO')]);
    const r = await svc.aplicar({ usuarioIds: ['10', '11', '12'], rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(r.agregados).toBe(1);
    expect(r.omitidos.map((o) => o.usuarioId).sort()).toEqual(['10', '11']);
    expect(r.omitidos[0].motivo).toMatch(/no se combina/);
  });

  it('omite desactivados y la propia cuenta del administrador que actúa', async () => {
    const { svc } = montar([cuenta(10n, 'MOZO', [], false), { ...cuenta(1n, 'CAJERO'), party_id: 1n }]);
    const r = await svc.aplicar({ usuarioIds: ['10', '1'], rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(r.agregados).toBe(0);
    expect(r.omitidos).toHaveLength(2);
  });

  it('quita el rol extra en bloque; quien no lo tiene cuenta aparte', async () => {
    const { svc, tx, auditoria } = montar([cuenta(10n, 'CAJERO', ['APOYO_DELIVERY']), cuenta(11n, 'MOZO')]);
    const r = await svc.aplicar({ usuarioIds: ['10', '11'], rol: 'APOYO_DELIVERY', accion: 'quitar' }, ADMIN);
    expect(r).toMatchObject({ quitados: 1, yaTenian: 1 });
    expect(tx.userAccountRol.deleteMany).toHaveBeenCalledWith({ where: { user_account_id: { in: [10n] }, rol: 'APOYO_DELIVERY' } });
    expect(tx.userAccountRolHistorial.createMany.mock.calls[0][0].data[0].accion).toBe('RETIRADO');
    const u = auditoria.registrar.mock.calls.find((c: any[]) => c[0].entidad === 'user_account');
    expect(u[0]).toMatchObject({ antes: { roles: ['CAJERO', 'APOYO_DELIVERY'] }, despues: { roles: ['CAJERO'] } });
  });

  it('nunca quita el rol principal (último rol de la persona)', async () => {
    const { svc, prisma } = montar([cuenta(10n, 'CAJERO')]);
    const r = await svc.aplicar({ usuarioIds: ['10'], rol: 'CAJERO', accion: 'quitar' }, ADMIN);
    expect(r.quitados).toBe(0);
    expect(r.omitidos[0].motivo).toMatch(/principal/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('no quita ADMIN al último administrador activo', async () => {
    const { svc } = montar([cuenta(10n, 'ADMIN')], 1);
    const r = await svc.aplicar({ usuarioIds: ['10'], rol: 'ADMIN', accion: 'quitar' }, ADMIN);
    expect(r.quitados).toBe(0);
    expect(r.omitidos[0].motivo).toMatch(/último administrador/);
  });

  it('«todos» consulta solo cuentas activas por defecto', async () => {
    const { svc, prisma } = montar([cuenta(10n, 'MOZO')]);
    await svc.aplicar({ usuarioIds: 'todos', rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(prisma.userAccount.findMany.mock.calls[0][0].where).toEqual({ activo: true });
  });

  it('trabaja por lotes de 50 (una transacción por lote)', async () => {
    const muchas = Array.from({ length: 120 }, (_, i) => cuenta(BigInt(i + 10), 'MOZO'));
    const { svc, prisma } = montar(muchas);
    const r = await svc.aplicar({ usuarioIds: 'todos', rol: 'APOYO_DELIVERY', accion: 'agregar' }, ADMIN);
    expect(r.agregados).toBe(120);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('valida rol, lista vacía y que solo el ADMIN pueda', async () => {
    const { svc } = montar([]);
    await expect(svc.aplicar({ usuarioIds: ['1'], rol: 'INVENTADO', accion: 'agregar' }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.aplicar({ usuarioIds: [], rol: 'MOZO', accion: 'agregar' }, ADMIN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.aplicar({ usuarioIds: ['1'], rol: 'MOZO', accion: 'agregar' }, { ...ADMIN, rol: 'CAJERO' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('rol APOYO_DELIVERY', () => {
  it('existe, tiene permisos de delivery y NO el de liquidar efectivo', () => {
    expect(ROLES.some((r) => r.codigo === 'APOYO_DELIVERY')).toBe(true);
    expect(MATRIZ.APOYO_DELIVERY).toEqual(expect.arrayContaining(['repartos/ver', 'repartos/tomar', 'repartos/entregar']));
    expect(MATRIZ.APOYO_DELIVERY).not.toContain('repartos/liquidar');
  });
});
