import { describe, it, expect } from 'vitest';
import { resumirDia, esPorCobrar, filasDePedidos } from '../resumenDia';

/**
 * Día con: 2 pedidos pagados (S/ 30 y S/ 20), 1 pedido de efectivo por cobrar (S/ 15),
 * y 2 pedidos «Tarjeta / Yape en línea» que esperan el pago del cliente (POR_PAGAR, S/ 50 y S/ 12).
 * Lo que espera pago en línea no es venta ni cobro pendiente del día.
 */
describe('Resumen del día: pedidos en línea sin pagar', () => {
  const filas = [
    { estado: 'ENTREGADO', pago_estado: 'PAGADO', n: 1, total: 30 },
    { estado: 'COLA', pago_estado: 'PAGADO', n: 1, total: 20 },
    { estado: 'COLA', pago_estado: 'PENDIENTE', n: 1, total: 15 },
    { estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', n: 1, total: 50 },
    { estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', n: 1, total: 12 },
  ];

  it('ventas = cobrado + por cobrar; los POR_PAGAR no suman a ventas, activos ni por cobrar', () => {
    const r = resumirDia(filas);
    expect(r.ventas).toBe(65);
    expect(r.cobrado).toBe(50);
    expect(r.montoPorCobrar).toBe(15);
    expect(r.porCobrar).toBe(1);
    expect(r.ventas).toBe(r.cobrado + r.montoPorCobrar);
    expect(r.activos).toBe(2);
    expect(r.total).toBe(3);
  });

  it('un pedido en línea sin pagar no cuenta como por cobrar aunque su pago_estado no venga', () => {
    expect(esPorCobrar({ estado: 'POR_PAGAR', pago_estado: null })).toBe(false);
    expect(esPorCobrar({ estado: 'COLA', pago_estado: 'PENDIENTE_ONLINE' })).toBe(false);
    expect(esPorCobrar({ estado: 'COLA', pago_estado: 'PENDIENTE' })).toBe(true);
  });

  it('desde la lista cargada da el mismo resultado que desde el API agrupado', () => {
    const lista = [
      { estado: 'ENTREGADO', pago_estado: 'PAGADO', total: 30 },
      { estado: 'COLA', pago_estado: 'PAGADO', total: 20 },
      { estado: 'COLA', pago_estado: 'PENDIENTE', total: 15 },
      { estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', total: 50 },
      { estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', total: 12 },
    ] as any[];
    expect(resumirDia(filasDePedidos(lista as any))).toEqual(resumirDia(filas));
  });
});
