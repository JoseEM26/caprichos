import { describe, it, expect } from 'vitest';
import {
  redondearMonto,
  calcularPrecioLinea,
  calcularSubtotalPedido,
  calcularTotalPedido,
} from '../utilidades/index.js';

describe('Cálculo de precios compartido', () => {
  it('redondea montos con dos decimales correctamente', () => {
    expect(redondearMonto(12.345)).toBe(12.35);
    expect(redondearMonto(12.344)).toBe(12.34);
    expect(redondearMonto(0)).toBe(0);
  });

  it('calcula precio unitario y subtotal de una línea sin opciones', () => {
    const res = calcularPrecioLinea({ precioBase: 15.5, cantidad: 2 });
    expect(res.precioUnitario).toBe(15.5);
    expect(res.subtotal).toBe(31);
  });

  it('calcula precio unitario y subtotal sumando opciones extras', () => {
    const res = calcularPrecioLinea({
      precioBase: 18,
      opciones: [
        { precioExtra: 2.5 },
        { precio_extra: 1.5 },
      ],
      cantidad: 3,
    });
    // 18 + 2.5 + 1.5 = 22 * 3 = 66
    expect(res.precioUnitario).toBe(22);
    expect(res.subtotal).toBe(66);
  });

  it('calcula subtotal acumulado de un pedido', () => {
    const subtotal = calcularSubtotalPedido([
      { subtotal: 31 },
      { subtotal: 66 },
      { subtotal: 9.9 },
    ]);
    expect(subtotal).toBe(106.9);
  });

  it('calcula total incluyendo costo de envío', () => {
    expect(calcularTotalPedido({ subtotal: 50, envio: 5 })).toBe(55);
    expect(calcularTotalPedido({ subtotal: 50, envio: null })).toBe(50);
    expect(calcularTotalPedido({ subtotal: 50 })).toBe(50);
  });
});
