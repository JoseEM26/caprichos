import { describe, expect, it } from 'vitest';
import { lineasTicketPago } from '../etiquetas/ticketPago.js';
import { descuentosDePedido, detalleLinea, entradaDeLineaPedido } from '../etiquetas/detalleLinea.js';
import type { TicketPagoDatos } from '../tipos/etiquetas.js';

const base: TicketPagoDatos = {
  local: { nombre: 'Caprichos' },
  codigo: 'CP-77',
  fecha: '08/11/2026',
  hora: '14:30',
  who: 'Ana Maria Fernandez de la Torre',
  modalidad: 'Delivery',
  entrega: 'Av. Los Constructores Internacionales 1234 Dpto 502, Santiago de Surco',
  clienteTelefono: '******789',
  lineas: [
    {
      cantidad: 2,
      nombre: 'Dona',
      tamano: 'Caja x6',
      precioUnit: 18,
      subtotal: 36,
      sabores: [
        { sabor: 'Fresa', cantidad: 3 },
        { sabor: 'Oreo', cantidad: 3 },
      ],
      nota: 'sin hielo ni azucar extra por favor, muchas gracias',
    },
    {
      cantidad: 1,
      nombre: 'Cafe Latte',
      tamano: 'Grande',
      subtotal: 14,
      opciones: [
        { grupo: 'Tipo de leche', nombre: 'Avena', extra: 2 },
        { grupo: 'Endulzante', nombre: 'Stevia' },
      ],
      nombresPersona: ['Luis'],
    },
    {
      cantidad: 1,
      nombre: 'Combo Duo',
      subtotal: 30,
      partes: [
        { cantidad: 1, nombre: 'Dona', tamano: 'Unidad', subtotal: 0, sabor: 'Manjar' },
        { cantidad: 1, nombre: 'Frappe', tamano: 'Mediano', subtotal: 0, opciones: [{ grupo: 'Bebida 1 · Bebida', nombre: 'Moka' }] },
      ],
    },
    { cantidad: 1, nombre: 'Galleta de la casa', subtotal: 0, cortesia: { valorLista: 6 } },
  ],
  subtotal: 80,
  descuentos: [
    { tipo: 'PROMO', nombre: 'Promo Duo Dulce', monto: 5 },
    { tipo: 'CUPON', nombre: 'Cupón VERANO', monto: 3 },
    { tipo: 'PERSONAL', nombre: 'Descuento del personal 25%', monto: 10 },
    { tipo: 'PUNTOS', nombre: 'Puntos canjeados (4)', monto: 4 },
  ],
  envio: 5,
  notaPedido: 'Tocar el timbre dos veces, el perro muerde',
  total: 63,
  propina: 0,
  pagaCon: 50,
  pagos: [],
  plan: [
    { medio: 'YAPE', monto: 38 },
    { medio: 'EFECTIVO', monto: 25 },
  ],
};

describe('ticket de pago detallado', () => {
  for (const cols of [32, 48]) {
    it(`imprime todo el detalle y no se desborda a ${cols} columnas`, () => {
      const filas = lineasTicketPago(base, cols).map((l) => l.texto);
      const t = filas.join(' ').replace(/\s+/g, ' '); // los renglones envueltos se leen seguidos
      for (const f of filas) expect(f.length, f).toBeLessThanOrEqual(cols);
      expect(t).toContain('Sabores: 3 Fresa · 3 Oreo');
      expect(t).toContain('2 x S/ 18.00');
      expect(t).toContain('Tipo de leche: Avena (+S/ 2.00)');
      expect(t).toContain('Endulzante: Stevia');
      expect(t).toContain('Para: Luis');
      expect(t).toContain('Nota: sin hielo');
      expect(t).toContain('- 1 x Dona (Unidad)');
      expect(t).toContain('Sabor: Manjar');
      expect(t).toContain('Bebida 1 · Bebida: Moka');
      expect(t).toContain('CORTESÍA S/ 0.00 (valor S/ 6.00)');
      expect(t).toContain('Promo Duo Dulce');
      expect(t).toContain('Cupón VERANO');
      expect(t).toContain('Descuento del personal 25%');
      expect(t).toContain('Puntos canjeados (4)');
      expect(t).toContain('Envío');
      expect(t).toContain('Pago dividido:');
      expect(t).toContain('Paga con');
      expect(t).toContain('Vuelto');
      expect(t).toContain('Nota del pedido: Tocar');
      expect(t).toContain('Entrega: Av.');
      expect(t).toContain('Celular: ******789');
    });
  }


  it('el ticket antiguo (sin campos nuevos) sigue saliendo igual', () => {
    const viejo: TicketPagoDatos = {
      local: { nombre: 'Caprichos' },
      codigo: 'CP-1',
      fecha: '01/01/2026',
      hora: '10:00',
      who: 'Juan',
      modalidad: 'Mesa',
      lineas: [{ cantidad: 2, nombre: 'Lomo', tamano: 'Grande', subtotal: 40 }],
      total: 40,
      pagos: [{ medio: 'EFECTIVO', monto: 40 }],
    };
    const t = lineasTicketPago(viejo, 32).map((l) => l.texto);
    expect(t.some((f) => f.startsWith('2 x Lomo (Grande)') && f.endsWith('S/ 40.00'))).toBe(true);
    expect(t.join('\n')).not.toContain('Subtotal');
  });
});

describe('entradaDeLineaPedido y descuentosDePedido', () => {
  it('cuelga las piezas del combo y acepta filas de la base', () => {
    const todas = [
      { id: 1n, cantidad: 1, nombre: 'Combo', subtotal: 30, precio_unit: 30, linea_combo_id: null },
      { id: 2n, cantidad: 1, nombre: 'Dona', tamano: 'Unidad', subtotal: 0, linea_combo_id: 1n, sabores: [{ sabor_nombre: 'Fresa', cantidad: 1 }] },
    ];
    const d = detalleLinea(entradaDeLineaPedido(todas[0], todas));
    expect(d.partes[0].detalles).toEqual(['Sabores: 1 Fresa']);
  });

  it('lee el descuento como lista o como objeto de cupón', () => {
    expect(descuentosDePedido({ descuento_detalle: { tipo: 'CUPON', codigo: 'X1', monto: 4 } })).toEqual([{ tipo: 'CUPON', nombre: 'Cupón X1', monto: 4 }]);
    expect(descuentosDePedido({ descuento: 3 })[0].nombre).toBe('Descuento');
  });
});
