import { describe, it, expect } from 'vitest';
import { maquetarGeneral, maquetarArea, maquetarBebida, FUENTES_TSPL, lineasTicketPago } from '../index.js';
import type { Primitiva, EtiquetaGeneralDatos, EtiquetaAreaDatos, EtiquetaBebidaDatos, TicketPagoDatos } from '../index.js';

const largo = 'ADMINISTRACION INTERNACIONAL DE EMPRESAS';
const general: EtiquetaGeneralDatos = {
  codigo: 'CP-W999', modalidad: 'Mesa', modalidadPill: 'MESA 3', who: 'Jose Espinoza', canal: 'Mozo', hora: '21:59', fecha: '25/10/2026',
  cantidadProductos: 9, nota: [largo, largo, largo, largo].join(' '), printer: 'Etiquetera de caja',
  productos: Array.from({ length: 9 }, (_, i) => ({ cantidad: i + 1, nombre: `Producto ${i + 1} ${largo}`, tamano: '12oz' })),
};
const area: EtiquetaAreaDatos = {
  areaNombre: 'COCINA', areaIndex: 1, totalAreas: 2, codigo: 'CP-W999', modalidadPill: 'MESA 3', who: 'Jose', canal: 'Mozo', hora: '21:59',
  fecha: '25/10/2026', esCompacta: false, nota: largo, printer: 'Etiquetera de cocina',
  lineas: Array.from({ length: 6 }, (_, i) => ({ cantidad: 2, nombre: `Sandwich ${i} ${largo}`, tamano: 'Grande', opciones: ['Sin cebolla', 'Salsa aparte'] })),
};
const bebida: EtiquetaBebidaDatos = {
  bebidaIndex: 1, totalBebidas: 2, codigo: 'CP-W999', persona: 'MARIA ELENA GUADALUPE DEL CARMEN',
  bebidaNombre: 'CAPPUCCINO VAINILLA CARAMELO SALADO CON CREMA BATIDA Y CHISPAS', tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azucar', 'Extra canela'], contiene: 'Avena, canela, espresso doble, vainilla natural, caramelo salado, crema batida',
  who: 'Para: Juan', hora: '21:59',
};

const casos: [string, () => ReturnType<typeof maquetarGeneral>][] = [
  ['general', () => maquetarGeneral(general)],
  ['area', () => maquetarArea(area)],
  ['bebida', () => maquetarBebida(bebida)],
];

describe('maqueta de etiquetas', () => {
  it.each(casos)('%s: lienzo vertical 508x813, logo y determinista', (_n, f) => {
    const m = f();
    expect([m.W, m.H]).toEqual([508, 813]);
    expect(m.primitivas.filter((p) => p.t === 'logo')).toHaveLength(1);
    expect(JSON.stringify(f())).toBe(JSON.stringify(m));
  });

  it.each(casos)('%s: todo texto queda dentro del lienzo y de su marco', (_n, f) => {
    const m = f();
    for (const p of m.primitivas as Primitiva[]) {
      if (p.t !== 'texto') continue;
      const f_ = FUENTES_TSPL[p.fuente];
      expect(p.x).toBeGreaterThanOrEqual(26);
      expect(p.x + p.texto.length * f_.ancho * p.xm).toBeLessThanOrEqual(m.W - 26);
      expect(p.y + f_.alto * p.ym).toBeLessThanOrEqual(m.H - 26);
    }
  });

  it('los textos largos se recortan con ... o + N mas', () => {
    const textos = maquetarGeneral(general).primitivas.flatMap((p) => (p.t === 'texto' ? [p.texto] : []));
    expect(textos.some((t) => t.endsWith('...'))).toBe(true);
    expect(textos.some((t) => /^\+ \d+ más$/.test(t))).toBe(true);
  });

  it('lo que va sobre una banda inversa se marca invertido', () => {
    const m = maquetarBebida(bebida);
    const cab = m.primitivas.find((p) => p.t === 'texto' && p.texto === 'CAPRICHOS');
    expect(cab && cab.t === 'texto' && cab.invertido).toBe(true);
  });
});

describe('lineasTicketPago', () => {
  const t: TicketPagoDatos = {
    local: { nombre: 'Caprichos', ruc: '2012345' }, codigo: 'CP-1', fecha: '30/10/2026', hora: '10:15', who: 'Jose', modalidad: 'MESA',
    lineas: [{ cantidad: 2, nombre: 'Frappe Oreo con un nombre larguisimo para cortar', tamano: '16oz', subtotal: 36 }],
    total: 36, pagos: [{ medio: 'EFECTIVO', monto: 36, recibido: 40, vuelto: 4 }], comprobante: { tipo: 'BOLETA', numero: 'B001-1' },
  };
  it.each([48, 32])('ninguna linea pasa de %i columnas', (c) => {
    const ls = lineasTicketPago(t, c);
    expect(ls.every((l) => l.texto.length <= c)).toBe(true);
    expect(ls.find((l) => l.texto.startsWith('TOTAL'))?.texto).toMatch(/S\/ 36\.00$/);
    expect(ls[0]).toMatchObject({ texto: 'Caprichos', centrado: true, negrita: true });
  });
});
