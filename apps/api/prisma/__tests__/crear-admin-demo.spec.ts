import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { crearAdminDemo, exigirDemo } from '../crear-admin-demo';

// Claves y URLs de prueba armadas por partes: no son credenciales reales
const CLAVE = ['prueba', '-', 'demo', '-', '2026'].join('');
const url = (host: string, base: string) => ['postgresql', '://', 'usuario', ':', 'pw', '@', host, '/', base].join('');

function prismaFalso(existente: unknown) {
  const tx = {
    partyIdentifier: {
      findUnique: jest.fn().mockResolvedValue(existente),
      create: jest.fn(),
    },
    party: { create: jest.fn().mockResolvedValue({ id: 7n }), update: jest.fn() },
    person: { upsert: jest.fn() },
    userAccount: { create: jest.fn(), update: jest.fn() },
  };
  const prisma = { $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { prisma: prisma as unknown as PrismaClient, tx };
}

describe('exigirDemo', () => {
  it('rechaza producción y bases con nombre de producción', () => {
    expect(() => exigirDemo({ AMBIENTE_DESPLIEGUE: 'prod', DATABASE_URL: url('postgres', 'caprichos_demo') })).toThrow();
    expect(() => exigirDemo({ AMBIENTE_DESPLIEGUE: 'demo', DATABASE_URL: url('postgres', 'caprichos_prod') })).toThrow();
    expect(() => exigirDemo({
      AMBIENTE_DESPLIEGUE: 'demo',
      DATABASE_URL: url('postgres', 'caprichos_demo'),
      REDIS_URL: 'redis://redis:6379',
    })).not.toThrow();
  });
});

describe('crearAdminDemo', () => {
  it('crea party, DNI y cuenta ADMIN sin obligar a cambiar la clave, con hash argon2id verificable', async () => {
    const { prisma, tx } = prismaFalso(null);
    await expect(crearAdminDemo(prisma, '10000001', CLAVE)).resolves.toBe('creado');

    expect(tx.partyIdentifier.create).toHaveBeenCalledWith({ data: { party_id: 7n, tipo: 'DNI', numero: '10000001' } });
    const cuenta = tx.userAccount.create.mock.calls[0][0].data;
    expect(cuenta).toMatchObject({ party_id: 7n, rol: 'ADMIN', debe_cambiar: false, activo: true });
    expect(cuenta.hash.startsWith('$argon2id$')).toBe(true);
    expect(await argon2.verify(cuenta.hash, CLAVE)).toBe(true);
    expect(JSON.stringify(tx.userAccount.create.mock.calls, (_, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain(CLAVE);
  });

  it('si el DNI ya tiene cuenta la actualiza (clave nueva, activa, sin cambio obligatorio) y no crea otra', async () => {
    const existente = { party_id: 9n, party: { usuario: { id: 3n } } };
    const { prisma, tx } = prismaFalso(existente);
    await expect(crearAdminDemo(prisma, '10000001', CLAVE)).resolves.toBe('actualizado');

    expect(tx.userAccount.create).not.toHaveBeenCalled();
    expect(tx.party.create).not.toHaveBeenCalled();
    const { where, data } = tx.userAccount.update.mock.calls[0][0];
    expect(where).toEqual({ id: 3n });
    expect(data).toMatchObject({ rol: 'ADMIN', debe_cambiar: false, activo: true });
    expect(await argon2.verify(data.hash, CLAVE)).toBe(true);
  });
});
