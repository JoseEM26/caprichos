import { describe, it, expect } from 'vitest';
import { lineasTicketPago } from '../etiquetas/ticketPago.js';
import type { TicketPagoDatos } from '../tipos/etiquetas.js';

const base: TicketPagoDatos = {
  local: { nombre: 'Caprichos' },
  codigo: 'CP-0001',
  fecha: '02-11-2026',
  hora: '10:00',
  who: '',
  modalidad: '',
  lineas: [{ cantidad: 1, nombre: 'Frappe', subtotal: 11.8 }],
  total: 11.8,
  pagos: [{ medio: 'EFECTIVO', monto: 11.8 }],
  comprobante: null,
};

describe('ticket de pago con boleta o factura electrónica', () => {
  it('imprime la representación, el hash en renglones de 32 columnas y la marca de prueba', () => {
    const t: TicketPagoDatos = {
      ...base,
      comprobante: {
        tipo: 'BOLETA',
        numero: 'B002-000001',
        representacion: 'Representación impresa de la Boleta de venta electrónica',
        hash: 'SIMULADO-B002-000001-ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        simulado: true,
      },
    };
    const textos = lineasTicketPago(t, 32).map((l) => l.texto);
    expect(textos).toContain('BOLETA B002-000001');
    // La frase larga se parte en dos renglones
    expect(textos.join(' ')).toContain('Representación impresa de la Boleta de venta electrónica');
    // El hash largo no cabe junto a «Hash:»: va en su propio renglón
    expect(textos).toContain('Hash:');
    expect(textos.some((x) => x.startsWith('SIMULADO-B002'))).toBe(true);
    expect(textos).toContain('SIMULADO - SIN VALOR TRIBUTARIO');
    expect(textos.every((x) => x.length <= 32)).toBe(true);
  });

  it('nota de venta no imprime representación ni hash', () => {
    const t: TicketPagoDatos = { ...base, comprobante: { tipo: 'NOTA_VENTA', numero: 'NV01-000002' } };
    const textos = lineasTicketPago(t, 32).map((l) => l.texto);
    expect(textos.some((x) => x.includes('Representación'))).toBe(false);
    expect(textos.some((x) => x.startsWith('Hash'))).toBe(false);
  });

  it('reserva el bloque del QR solo cuando hay cadena, antes del hash', () => {
    const c = { tipo: 'FACTURA', numero: 'F002-1', representacion: 'Representación impresa de la Factura electrónica', hash: 'H123', simulado: false };
    const sin = lineasTicketPago({ ...base, comprobante: c }, 32);
    expect(sin.some((l) => l.qr)).toBe(false);
    const con = lineasTicketPago({ ...base, comprobante: { ...c, cadenaQr: '20600000001|01|F002|1|1.80|11.80|2026-11-02|6|20600000001|' } }, 32);
    const i = con.findIndex((l) => l.qr);
    expect(i).toBeGreaterThan(con.findIndex((l) => l.texto.startsWith('FACTURA')));
    expect(con[i].centrado).toBe(true);
    expect(con[i + 1].texto.startsWith('Hash:')).toBe(true);
    expect(con.filter((l) => l.qr)).toHaveLength(1);
  });
});
