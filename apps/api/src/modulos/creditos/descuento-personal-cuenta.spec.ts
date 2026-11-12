import { descuentoPersonalDeCuenta, descuentoPersonalPorCelular } from './descuento-personal';

/** BD en memoria mínima: contactos del personal, cuentas de cliente y usuarios. */
function bd(o: { cuenta?: { telefono: string | null; usuario_party_id?: bigint | null } | null; usuarioActivo?: boolean; vinculadoActivo?: boolean; contactos?: Array<{ party_id: bigint; valor: string }> }) {
  const contactos = o.contactos ?? [];
  return {
    customerAccount: { findFirst: jest.fn().mockResolvedValue(o.cuenta === undefined ? { telefono: '900000001' } : o.cuenta) },
    userAccount: {
      findFirst: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.party_id === 1n ? (o.usuarioActivo ? { party_id: 1n } : null) : where.party_id === 7n && o.vinculadoActivo ? { party_id: 7n } : null),
      ),
    },
    contactMechanism: {
      findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(contactos.find((c) => where.valor.in.includes(c.valor)) ?? null)),
      findMany: jest.fn().mockResolvedValue(contactos),
    },
    partyRole: { findFirst: jest.fn().mockResolvedValue(null) },
    parametro: { findUnique: jest.fn().mockResolvedValue(null) },
  };
}

describe('descuento de personal por cuenta de cliente', () => {
  it('por persona: el party de la cuenta ya tiene usuario activo, sin mirar el celular', async () => {
    const db = bd({ usuarioActivo: true });
    expect(await descuentoPersonalDeCuenta(db, 1n)).toEqual({ pct: 25 });
    expect(db.contactMechanism.findFirst).not.toHaveBeenCalled();
  });

  it.each(['900000001', '51900000001', '+51 900 000 001', '900-000-001', '(+51) 900000001'])('por celular guardado como %s', async (valor) => {
    const db = bd({ contactos: [{ party_id: 9n, valor }] });
    expect(await descuentoPersonalDeCuenta(db, 2n)).toEqual({ pct: 25 });
  });

  it('el filtro exige contacto activo de usuario activo (usuario inactivo no)', async () => {
    const db = bd({ contactos: [] });
    expect(await descuentoPersonalDeCuenta(db, 2n)).toBeNull();
    const where = db.contactMechanism.findFirst.mock.calls[0][0].where;
    expect(where.activo).toBe(true);
    expect(where.party).toEqual({ usuario: { is: { activo: true } } });
  });

  it('sin cuenta de cliente (sin sesión) o con id inválido: null, igual que un cliente común', async () => {
    expect(await descuentoPersonalDeCuenta(bd({ cuenta: null, usuarioActivo: true }), 1n)).toBeNull();
    expect(await descuentoPersonalDeCuenta(bd({}), null)).toBeNull();
    expect(await descuentoPersonalDeCuenta(bd({}), 'x')).toBeNull();
  });

  it('un cliente que no es personal recibe la misma respuesta vacía', async () => {
    const db = bd({ contactos: [{ party_id: 9n, valor: '911111111' }] });
    expect(await descuentoPersonalDeCuenta(db, 2n)).toBeNull();
  });

  it('celular inválido: null', async () => {
    expect(await descuentoPersonalPorCelular(bd({}), '12345')).toBeNull();
  });

  it('vínculo del ADMIN: la cuenta vinculada a un usuario activo recibe el descuento del personal', async () => {
    const db = bd({ cuenta: { telefono: '900000001', usuario_party_id: 7n }, vinculadoActivo: true });
    expect(await descuentoPersonalDeCuenta(db, 2n)).toEqual({ pct: 25 });
  });

  it('vínculo con usuario inactivo, o sin vínculo: no hay descuento', async () => {
    expect(await descuentoPersonalDeCuenta(bd({ cuenta: { telefono: '900000001', usuario_party_id: 7n }, vinculadoActivo: false }), 2n)).toBeNull();
    expect(await descuentoPersonalDeCuenta(bd({ cuenta: { telefono: '900000001', usuario_party_id: null } }), 2n)).toBeNull();
  });
});
