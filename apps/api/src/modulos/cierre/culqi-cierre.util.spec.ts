import { devueltoCulqiDelDia, operacionesCulqiDeCaja } from './culqi-cierre.util';

describe('culqi-cierre.util: devolución por fuera', () => {
  const inicio = new Date('2026-10-21T05:00:00Z');
  const fin = new Date('2026-10-22T05:00:00Z');

  it('lo devuelto por Yape del local NO baja el bloque Culqi; lo devuelto por Culqi (o sin medio) sí', async () => {
    const db: any = {
      pagoOnlineIntento: {
        findMany: jest.fn().mockResolvedValue([
          { medio: 'YAPE', devoluciones: [{ monto_centimos: 5000, en: '2026-10-21T20:00:00Z', medio: 'YAPE' }] },
          { medio: 'YAPE', devoluciones: [{ monto_centimos: 1000, en: '2026-10-21T20:00:00Z', medio: 'CULQI' }, { monto_centimos: 200, en: '2026-10-21T21:00:00Z' }] },
        ]),
      },
    };
    expect(await devueltoCulqiDelDia(db, inicio, fin)).toEqual({ yape: 12, tarjeta: 0 });
  });

  it('el cobro anulado sigue en la lista de operaciones con estado «Devuelto por fuera» y el medio usado', async () => {
    const db: any = {
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, pedido_id: 9n, anulado_en: new Date(), en: new Date(), pedido: { codigo: 'CP-9' }, pagos: [{ medio: 'YAPE', monto: 50, propina: 0, origen: 'CULQI' }] },
          { id: 2n, pedido_id: 10n, anulado_en: null, en: new Date(), pedido: { codigo: 'CP-10' }, pagos: [{ medio: 'TARJETA', monto: 20, propina: 0, origen: 'CULQI' }] },
        ]),
      },
      pagoOnlineIntento: {
        findMany: jest.fn().mockResolvedValue([
          { pedido_id: 9n, culqi_cargo_id: 'chr_9', devoluciones: [{ monto_centimos: 5000, medio: 'YAPE', en: '2026-10-21T20:00:00Z' }] },
          { pedido_id: 10n, culqi_cargo_id: 'chr_10', devoluciones: [] },
        ]),
      },
    };
    const ops = await operacionesCulqiDeCaja(db, 1n);
    expect(ops[0]).toMatchObject({ pedidoCodigo: 'CP-9', monto: 50, estado: 'DEVUELTO_FUERA', devueltoPor: ['YAPE'], operacion: 'chr_9' });
    expect(ops[1]).toMatchObject({ pedidoCodigo: 'CP-10', estado: 'COBRADO', devueltoPor: [] });
    expect(db.cobro.findMany.mock.calls[0][0].where).not.toHaveProperty('anulado_en');
  });
});
