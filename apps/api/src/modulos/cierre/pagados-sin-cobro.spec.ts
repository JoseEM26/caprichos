import { pagadosSinCobroDelDia } from './cierre.util';

describe('pagadosSinCobroDelDia', () => {
  const dia = { gte: new Date('2026-11-26T05:00:00Z'), lt: new Date('2026-11-27T05:00:00Z') };
  const db = (pedidos: any[]) => ({ pedido: { findMany: jest.fn().mockResolvedValue(pedidos) } });

  it('no avisa el delivery pagado solo en efectivo (entra por la liquidación del repartidor)', async () => {
    const r = await pagadosSinCobroDelDia(
      db([
        { codigo: 'W1', modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', planPago: [] },
        { codigo: 'W2', modalidad: 'DELIVERY', pago_metodo: 'MIXTO', planPago: [{ medio: 'EFECTIVO', monto: 10 }, { medio: 'YAPE', monto: 5 }] },
        { codigo: 'W3', modalidad: 'DELIVERY', pago_metodo: 'YAPE', planPago: [] },
        { codigo: 'L1', modalidad: 'LLEVAR', pago_metodo: 'EFECTIVO', planPago: [] },
      ]),
      dia,
    );
    expect(r.map((p) => p.codigo)).toEqual(['W2', 'W3', 'L1']);
  });
});
