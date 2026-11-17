import { describe, it, expect } from 'vitest';
import { lineasCuponCine, textoValorCupon } from '../etiquetas/cuponCine.js';
import { lineasTicketPago } from '../etiquetas/ticketPago.js';
import { ticketPagoEjemploCupon } from '../etiquetas/cuponEjemplo.js';
import type { TicketPagoDatos } from '../tipos/etiquetas.js';

const datos = {
  codigo: 'AMIGO15-K7M2PQ',
  valor: '25 % DE DESCUENTO',
  alcance: 'Toda la carta',
  vence: '15/05/2026',
  numero: 2,
  tope: 200,
};

describe('lineasCuponCine (cupón de colección)', () => {
  it('lleva marca, valor, alcance, vigencia, talón numerado, código y QR', () => {
    const l = lineasCuponCine(datos, 48);
    const t = l.map((x) => x.texto).join('\n');
    expect(t).toContain('C A P R I C H O S');
    expect(t).toContain('25 % DE DESCUENTO');
    expect(t).toContain('Alcance: Toda la carta');
    expect(t).toContain('Válido hasta 15/05/2026');
    expect(t).toContain('N.º 0002 de 0200');
    expect(t).toContain('AMIGO15-K7M2PQ');
    expect(t).toContain('Presenta este ticket en tu próxima visita');
    expect(l.find((x) => x.qr)?.qr).toBe('AMIGO15-K7M2PQ');
  });

  it('monocromo y sin renglones más anchos que la columna (48 y 32)', () => {
    for (const cols of [48, 32]) {
      const l = lineasCuponCine(datos, cols);
      for (const x of l) expect(x.texto.length).toBeLessThanOrEqual(cols);
    }
  });

  it('sin numero no sale el talón numerado; sin tope sale solo el número', () => {
    expect(lineasCuponCine({ codigo: 'X-1' }, 48).some((x) => x.texto.includes('N.º'))).toBe(false);
    expect(lineasCuponCine({ codigo: 'X-1', numero: 7 }, 48).some((x) => x.texto.includes('N.º 0007'))).toBe(true);
  });

  it('textoValorCupon: porcentaje, monto y envío gratis', () => {
    expect(textoValorCupon('PORCENTAJE', 25)).toBe('25 % DE DESCUENTO');
    expect(textoValorCupon('MONTO', 5)).toBe('S/ 5.00 DE DESCUENTO');
    expect(textoValorCupon('ENVIO_GRATIS', 0)).toBe('ENVÍO GRATIS');
  });
});

describe('ticket de pago con cupón de colección', () => {
  const base: TicketPagoDatos = {
    local: { nombre: 'Caprichos' },
    codigo: 'CP-1',
    fecha: '01/01/2027',
    hora: '10:00',
    who: 'Lucía',
    lineas: [{ cantidad: 1, nombre: 'Café', subtotal: 10 }],
    subtotal: 10,
    total: 10,
    pagos: [{ medio: 'EFECTIVO', monto: 10 }],
  } as any;

  it('el cupón sale una sola vez, en la misma plantilla', () => {
    const t = lineasTicketPago({ ...base, cuponSiguiente: { codigo: 'AMIGO15-K7M2PQ', valor: '25 % DE DESCUENTO', alcance: 'Toda la carta', vence: '15/05/2026', numero: 2, tope: 200 } }, 48);
    const texto = t.map((x) => x.texto).join('\n');
    expect(texto.split('C A P R I C H O S').length - 1).toBe(1);
    expect(texto).toContain('N.º 0002 de 0200');
    expect(texto).not.toContain('Tu cupón para tu próxima compra');
  });

  it('sin cupón, el ticket no lleva bloque', () => {
    const texto = lineasTicketPago(base, 48).map((x) => x.texto).join('\n');
    expect(texto).not.toContain('CUPÓN DE COLECCIÓN');
  });
});

describe('ticketPagoEjemploCupon (vista previa con datos reales)', () => {
  it('UNICO y ASIGNADO dibujan la misma plantilla con alcance, vigencia y dados', () => {
    const asignado = ticketPagoEjemploCupon({
      modo: 'ASIGNADO_PERSONAL',
      codigoBase: 'AMIGO15',
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 25,
      alcance: 'Solo Dona glaseada',
      vence: '15/05/2026',
      dados: 1,
      tope: 200,
    });
    expect(asignado.cuponSiguiente).toMatchObject({ valor: '25 % DE DESCUENTO', alcance: 'Solo Dona glaseada', vence: '15/05/2026', numero: 2, tope: 200 });
    const texto = lineasTicketPago(asignado, 48).map((x) => x.texto).join('\n');
    expect(texto).toContain('C A P R I C H O S');
    expect(texto).toContain('Válido hasta 15/05/2026');
  });

  it('COMPARTIDO no lleva cupón al pie', () => {
    const t = ticketPagoEjemploCupon({ modo: 'COMPARTIDO', codigoBase: 'X', descuentoTipo: 'MONTO', descuentoValor: 5 });
    expect(t.cuponSiguiente).toBeUndefined();
  });
});
