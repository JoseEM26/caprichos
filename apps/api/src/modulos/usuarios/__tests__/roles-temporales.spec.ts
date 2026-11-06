import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { UsuariosRolesService } from '../usuarios-roles.service';
import { UsuariosActividadService, fechaCorta } from '../usuarios-actividad.service';
import { rolesDeCuenta } from '../../acceso/roles-usuario';
import { esOperadorSinCodigo } from '../../supervisor-codigo/supervisor-codigo.service';

const ADMIN = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const AHORA = new Date('2026-11-06T15:00:00.000Z');

function prismaMock(extra: Record<string, any> = {}) {
  const tx: any = {
    userAccountRol: { create: jest.fn().mockResolvedValue({}), delete: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    userAccountRolHistorial: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma: any = {
    userAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 30n, rol: 'CAJERO', activo: true, rolesExtra: [] }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userAccountRol: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany: tx.userAccountRol.deleteMany,
    },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    ...extra,
  };
  return { prisma, tx };
}
const auditoria = () => ({ registrar: jest.fn().mockResolvedValue(undefined) });

describe('vigencia de roles extra', () => {
  it('rolesDeCuenta filtra los roles vencidos (la consulta excluye vence_en <= ahora)', async () => {
    const findMany = jest.fn().mockResolvedValue([{ rol: 'SUPERVISOR' }]);
    const prisma: any = { userAccountRol: { findMany } };
    const roles = await rolesDeCuenta(prisma, 10n, 'CAJERO');
    expect(roles).toEqual(['CAJERO', 'SUPERVISOR']);
    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ vence_en: null }, { vence_en: { gt: expect.any(Date) } }]);
  });

  it('esOperadorSinCodigo: el SUPERVISOR temporal vigente queda exento; la consulta exige vigencia', async () => {
    const findFirst = jest.fn().mockResolvedValue({ party_id: 30n, id: 10n, rol: 'CAJERO' });
    const prisma: any = { userAccount: { findFirst } };
    const r = await esOperadorSinCodigo(prisma, 30n);
    expect(r).not.toBeNull();
    const where = findFirst.mock.calls[0][0].where;
    const extra = where.OR[1].rolesExtra.some;
    expect(extra.rol).toBe('SUPERVISOR');
    expect(extra.OR).toEqual([{ vence_en: null }, { vence_en: { gt: expect.any(Date) } }]);
  });
});

describe('UsuariosRolesService.otorgar', () => {
  it('solo ADMIN puede otorgar', async () => {
    const { prisma } = prismaMock();
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await expect(svc.otorgar(10n, { rol: 'SUPERVISOR' }, { ...ADMIN, rol: 'CAJERO', partyId: 2n } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nadie se otorga roles a sí mismo', async () => {
    const { prisma } = prismaMock({
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 1n, rol: 'CAJERO', activo: true, rolesExtra: [] }), findFirst: jest.fn() },
    });
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await expect(svc.otorgar(10n, { rol: 'SUPERVISOR' }, ADMIN as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('no combina ADMIN ni REPARTIDOR con otro rol', async () => {
    const { prisma } = prismaMock();
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await expect(svc.otorgar(10n, { rol: 'ADMIN' }, ADMIN as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.otorgar(10n, { rol: 'REPARTIDOR' }, ADMIN as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no repite un rol que ya tiene', async () => {
    const { prisma } = prismaMock({
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 30n, rol: 'CAJERO', activo: true, rolesExtra: [{ rol: 'SUPERVISOR' }] }), findFirst: jest.fn() },
    });
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await expect(svc.otorgar(10n, { rol: 'SUPERVISOR' }, ADMIN as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza una fecha de fin que ya pasó', async () => {
    const { prisma } = prismaMock();
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await expect(svc.otorgar(10n, { rol: 'SUPERVISOR', hasta: '2020-01-01T00:00:00Z' }, ADMIN as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('otorga con motivo y fin: escribe el rol y una fila OTORGADO en el historial', async () => {
    const { prisma, tx } = prismaMock();
    const aud = auditoria();
    const svc = new UsuariosRolesService(prisma, aud as any);
    const hasta = new Date(Date.now() + 86400000).toISOString();
    await svc.otorgar(10n, { rol: 'SUPERVISOR', motivo: 'El supervisor no viene', hasta }, ADMIN as any);
    expect(tx.userAccountRol.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_account_id: 10n, rol: 'SUPERVISOR', otorgado_por: 1n, motivo: 'El supervisor no viene' }),
    });
    expect(tx.userAccountRolHistorial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'OTORGADO', quien_party_id: 1n, rol: 'SUPERVISOR' }),
    });
    expect(aud.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'OTORGAR_ROL_TEMPORAL' }));
  });
});

describe('UsuariosRolesService.retirar y vencimientos', () => {
  it('retirar borra el rol y anota RETIRADO', async () => {
    const { prisma, tx } = prismaMock({
      userAccountRol: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ otorgado_en: new Date('2026-11-01T00:00:00Z'), vence_en: null, motivo: null }),
        deleteMany: jest.fn(),
      },
    });
    tx.userAccountRol.delete = jest.fn().mockResolvedValue({});
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    await svc.retirar(10n, 'SUPERVISOR', ADMIN as any);
    expect(tx.userAccountRol.delete).toHaveBeenCalled();
    expect(tx.userAccountRolHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({ accion: 'RETIRADO', rol: 'SUPERVISOR' }) });
  });

  it('cerrarRolesVencidos anota VENCIDO una sola vez por vencimiento', async () => {
    const vence = new Date('2026-11-05T23:00:00Z');
    const fila = { user_account_id: 10n, rol: 'SUPERVISOR', otorgado_en: new Date('2026-11-01T00:00:00Z'), vence_en: vence, motivo: 'x' };
    const { prisma, tx } = prismaMock({
      userAccountRol: { findMany: jest.fn().mockResolvedValue([fila]), findUnique: jest.fn(), deleteMany: jest.fn() },
    });
    tx.userAccountRol.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const svc = new UsuariosRolesService(prisma, auditoria() as any);
    expect(await svc.cerrarRolesVencidos(AHORA)).toBe(1);
    expect(tx.userAccountRolHistorial.create).toHaveBeenCalledTimes(1);
    expect(tx.userAccountRolHistorial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accion: 'VENCIDO', quien_party_id: null, hasta: vence }),
    });
    // Segunda pasada (otra instancia): ya no borra nada y no anota de nuevo
    expect(await svc.cerrarRolesVencidos(AHORA)).toBe(0);
    expect(tx.userAccountRolHistorial.create).toHaveBeenCalledTimes(1);
  });
});

describe('UsuariosActividadService', () => {
  it('solo ADMIN ve la actividad de otra persona', async () => {
    const svc = new UsuariosActividadService({} as any);
    await expect(svc.listar(10n, {}, { ...ADMIN, rol: 'SUPERVISOR' } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fecha en español y hora de Lima', () => {
    expect(fechaCorta(new Date('2026-11-07T23:00:00.000Z'))).toBe('7 nov 18:00');
  });

  it('arma el texto del rol temporal en español claro', async () => {
    const persona = (pid: bigint, nombres: string, apellidos: string) => ({ party_id: pid, nombres, apellidos });
    const prisma: any = {
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 10n, party_id: 30n }) },
      partyRole: { findMany: jest.fn().mockResolvedValue([]) },
      asistenciaMarca: { findMany: jest.fn().mockResolvedValue([]) },
      userAccountRolHistorial: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 5n,
            user_account_id: 10n,
            rol: 'SUPERVISOR',
            accion: 'OTORGADO',
            quien_party_id: 1n,
            desde: new Date('2026-11-06T15:00:00Z'),
            hasta: new Date('2026-11-07T23:00:00Z'),
            motivo: 'Cubre al titular',
            en: new Date('2026-11-06T15:00:00Z'),
          },
        ]),
      },
      auditoria: { findMany: jest.fn().mockResolvedValue([]) },
      person: { findMany: jest.fn().mockResolvedValue([persona(1n, 'Juan', 'Pérez'), persona(30n, 'Ana', 'Ruiz')]) },
      areaCocina: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const svc = new UsuariosActividadService(prisma);
    const r = await svc.listar(10n, {}, ADMIN as any);
    expect(r.datos[0].texto).toBe('Juan Pérez le dio el rol Supervisor a Ana Ruiz hasta el 7 nov 18:00');
    expect(r.datos[0].motivo).toBe('Cubre al titular');
    expect(r.datos[0].tipo).toBe('roles');
  });
});
