import { describe, expect, it } from 'vitest';
import { lineasTicketPago } from '../etiquetas/ticketPago.js';
import { descuentosDePedido } from '../etiquetas/detalleLinea.js';
import { ticketPagoEjemploCupon } from '../etiquetas/cuponEjemplo.js';

const texto = (t: ReturnType<typeof ticketPagoEjemploCupon>, cols = 48) => lineasTicketPago(t, cols).map((l) => l.texto);

describe('Voucher con cupón', () => {
  it('COMPARTIDO 25%: pedido con descuento_detalle CUPON imprime «Cupón 25OFF» con su monto antes del TOTAL', () => {
    // lo que guardan la carta, la caja y el mozo en el pedido
    const descuentos = descuentosDePedido({ descuento_detalle: { tipo: 'CUPON', codigo: '25OFF', monto: 12.63 } });
    expect(descuentos).toEqual([{ tipo: 'CUPON', nombre: 'Cupón 25OFF', monto: 12.63 }]);
    const t = ticketPagoEjemploCupon({ modo: 'COMPARTIDO', codigoBase: '25OFF', descuentoTipo: 'PORCENTAJE', descuentoValor: 25 });
    const l = texto(t);
    const iCupon = l.findIndex((x) => x.startsWith('Cupón 25OFF'));
    expect(iCupon).toBeGreaterThan(-1);
    expect(l[iCupon]).toMatch(/-S\/ 13\.13$/); // 25% de 52.50
    expect(l.findIndex((x) => x.startsWith('TOTAL'))).toBeGreaterThan(iCupon);
    expect(l.find((x) => x.startsWith('TOTAL'))).toMatch(/S\/ 39\.37$/);
    // COMPARTIDO no imprime su código
    expect(l.join('\n')).not.toContain('próxima compra');
  });

  it('UNICO_COMPROBANTE: además imprime el cupón con su código al pie', () => {
    const t = ticketPagoEjemploCupon({ modo: 'UNICO_COMPROBANTE', codigoBase: 'DULCE10', descuentoTipo: 'MONTO', descuentoValor: 10 });
    const l = texto(t);
    expect(l.find((x) => x.startsWith('Cupón DULCE10'))).toMatch(/-S\/ 10\.00$/);
    const i = l.findIndex((x) => x.includes('CUPÓN DE COLECCIÓN'));
    expect(i).toBeGreaterThan(l.findIndex((x) => x.startsWith('TOTAL')));
    expect(l.join('\n')).toContain('DULCE10-A1B2C3');
    expect(l.join('\n')).toContain('S/ 10.00 DE DESCUENTO');
  });

  it('ASIGNADO_PERSONAL (lo da el mozo o cajero): el código sale al pie como el de código único', () => {
    const t = ticketPagoEjemploCupon({ modo: 'ASIGNADO_PERSONAL', codigoBase: 'AMIGO15', descuentoTipo: 'PORCENTAJE', descuentoValor: 15 });
    const l = texto(t);
    const i = l.findIndex((x) => x.includes('CUPÓN DE COLECCIÓN'));
    expect(i).toBeGreaterThan(l.findIndex((x) => x.startsWith('TOTAL')));
    expect(l.join('\n')).toContain('AMIGO15-A1B2C3');
    expect(l.join('\n')).toContain('15 % DE DESCUENTO');
  });

  it('envío gratis: el ticket nombra el cupón aunque no reste soles', () => {
    const detalle = { tipo: 'CUPON', codigo: 'ENVIOFREE', descuentoTipo: 'ENVIO_GRATIS', montoDescontado: 0 };
    const d = descuentosDePedido({ descuento_detalle: detalle });
    expect(d).toHaveLength(1);
    const t = ticketPagoEjemploCupon({ modo: 'COMPARTIDO', codigoBase: 'ENVIOFREE', descuentoTipo: 'ENVIO_GRATIS', descuentoValor: 0 });
    const l = texto(t);
    expect(l.find((x) => x.includes('Cupón ENVIOFREE'))).toMatch(/envío gratis\)? *S\/ 0\.00$/);
  });

  it('en papel de 58 mm el descuento también sale', () => {
    const t = ticketPagoEjemploCupon({ modo: 'COMPARTIDO', codigoBase: '25OFF', descuentoTipo: 'PORCENTAJE', descuentoValor: 25 });
    expect(texto(t, 32).join('\n')).toContain('Cupón 25OFF');
  });
});
