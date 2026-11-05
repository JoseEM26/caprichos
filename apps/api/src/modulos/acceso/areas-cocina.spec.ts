import { areasPermitidasDeUsuario } from './roles-usuario';

describe('areasPermitidasDeUsuario', () => {
  const prisma = (areas: bigint[] | null) => ({
    userAccount: {
      findUnique: jest.fn().mockResolvedValue({ id: 1n, areasCocina: (areas ?? []).map((area_id) => ({ area_id })) }),
    },
  }) as any;

  it('COCINA sin áreas marcadas ve todas (null)', async () => {
    expect(await areasPermitidasDeUsuario(prisma(null), { partyId: 5n, rol: 'COCINA', roles: ['COCINA'] })).toBeNull();
  });

  it('COCINA con áreas marcadas ve la unión de esas áreas', async () => {
    const res = await areasPermitidasDeUsuario(prisma([1n, 3n, 3n]), { partyId: 5n, rol: 'COCINA', roles: ['COCINA'] });
    expect(res).toEqual([1n, 3n]);
  });

  it('un rol que no es COCINA no se restringe, aunque tenga áreas guardadas', async () => {
    const p = prisma([1n]);
    expect(await areasPermitidasDeUsuario(p, { partyId: 5n, rol: 'ADMIN', roles: ['ADMIN'] })).toBeNull();
    expect(await areasPermitidasDeUsuario(p, { partyId: 5n, rol: 'CAJERO', roles: ['CAJERO', 'COCINA'] })).toEqual([1n]);
    expect(p.userAccount.findUnique).toHaveBeenCalledTimes(1);
  });

  it('COCINA como rol extra también cuenta', async () => {
    expect(await areasPermitidasDeUsuario(prisma([2n]), { partyId: 5n, rol: 'MOZO', roles: ['MOZO', 'COCINA'] })).toEqual([2n]);
  });
});
