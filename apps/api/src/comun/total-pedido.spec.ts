import { descuentoParaComprobante, totalPedido } from './total-pedido';
import { calcularComprobante, aCentimos } from '../modulos/comprobantes/facturacion/facturacion.calculo';

describe('totalPedido / canje de puntos', () => {
  it('resta descuentos y puntos, suma envío, sin negativos', () => {
    expect(totalPedido({ subtotal: 40, descuento: 5, envio: 4, puntosCanjeados: 10 })).toBe(29);
    expect(totalPedido({ subtotal: 10, descuento: 0, envio: 0, puntosCanjeados: 10 })).toBe(0);
    expect(totalPedido({ subtotal: '12.5', envio: null, puntosCanjeados: null })).toBe(12.5);
  });

  it('el comprobante de un pedido con canje cuadra sobre lo realmente pagado', () => {
    const pedido = { subtotal: 40, descuento: 5, envio: 4, puntos_canjeados: 10 };
    const total = totalPedido({ ...pedido, puntosCanjeados: pedido.puntos_canjeados });
    const base = { lineas: [{ nombre: 'Frappe', cantidad: 2, subtotalCents: 4000 }], envioCents: 400, totalCents: aCentimos(total), igvPct: 10.5 };
    const r = calcularComprobante({ ...base, descuentoCents: aCentimos(descuentoParaComprobante(pedido)) });
    expect(r.totalCents).toBe(2900);
    // solo con el descuento (sin los puntos) el cálculo rechazaba el pedido: la boleta/factura no se podía emitir
    expect(() => calcularComprobante({ ...base, descuentoCents: 500 })).toThrow('no cuadran');
  });
});
