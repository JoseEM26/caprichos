import { pagosOnlineDe } from './pago-online-resumen';

const intento = (o: any) => ({ pedido_id: 1n, medio: 'YAPE', marca: null, ultimos4: null, culqi_cargo_id: 'chr_1', monto_centimos: 5000, devuelto_centimos: 0, aprobado_en: new Date('2026-11-01T15:00:00Z'), modo: 'REAL', ...o });

describe('pagosOnlineDe', () => {
  it('estado Aprobado / Devuelto parcial / Devuelto según lo devuelto; trae marca, últimos 4 y nº de operación', async () => {
    const db: any = {
      pagoOnlineIntento: {
        findMany: jest.fn().mockResolvedValue([
          intento({ pedido_id: 1n }),
          intento({ pedido_id: 2n, medio: 'TARJETA', marca: 'Visa', ultimos4: '1111', culqi_cargo_id: 'chr_2', devuelto_centimos: 2000 }),
          intento({ pedido_id: 3n, culqi_cargo_id: 'chr_3', devuelto_centimos: 5000 }),
        ]),
      },
    };
    const r = await pagosOnlineDe(db, [1n, 2n, 3n, 4n]);
    expect(r.get('1')).toMatchObject({ estado: 'APROBADO', cargoId: 'chr_1', monto: 50, devuelto: 0 });
    expect(r.get('2')).toMatchObject({ estado: 'DEVUELTO_PARCIAL', medio: 'TARJETA', marca: 'Visa', ultimos4: '1111', devuelto: 20 });
    expect(r.get('3')).toMatchObject({ estado: 'DEVUELTO' });
    expect(r.has('4')).toBe(false);
  });

  it('sin pedidos o sin tabla (mocks viejos) devuelve vacío sin consultar', async () => {
    expect((await pagosOnlineDe({}, [1n])).size).toBe(0);
    const db: any = { pagoOnlineIntento: { findMany: jest.fn() } };
    expect((await pagosOnlineDe(db, [])).size).toBe(0);
    expect(db.pagoOnlineIntento.findMany).not.toHaveBeenCalled();
  });
});
