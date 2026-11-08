import { describe, it, expect } from 'vitest';
import {
  FUENTES_TSPL,
  PRESETS_TAMANO_ETIQUETA,
  TAMANO_BEBIDA_DEFECTO,
  aplicarOrientacion,
  maquetarBebida,
  maquetarGeneral,
  tamanoEfectivo,
  tamanoPcValido,
} from '../index.js';
import type { EtiquetaBebidaDatos, EtiquetaGeneralDatos, Maqueta, Primitiva } from '../index.js';

const largo = 'ADMINISTRACION INTERNACIONAL DE EMPRESAS';
const general: EtiquetaGeneralDatos = {
  codigo: 'CP-W999', modalidad: 'Delivery', modalidadPill: 'DELIVERY', who: 'Jose Espinoza Morales de la Cruz', canal: 'WhatsApp', hora: '21:59', fecha: '07/11/2026',
  cantidadProductos: 14, total: 123.5, printer: 'Etiquetera', direccion: 'Av. Siempre Viva 742 Dpto 301 Miraflores', telefono: '999888777', nota: 'Sin azucar y con mucho hielo por favor',
  productos: Array.from({ length: 14 }, (_, i) => ({ cantidad: 1 + (i % 3), nombre: `Producto ${i + 1} ${largo}`, tamano: i % 2 ? '12oz' : null })),
};
const bebida: EtiquetaBebidaDatos = {
  bebidaIndex: 1, totalBebidas: 3, codigo: 'CP-W999', persona: 'Maria de los Angeles Fernandez', bebidaNombre: 'Cappuccino con leche de almendras', tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azucar', 'Extra shot', 'Canela'], contiene: 'Avena, canela, vainilla, caramelo', who: 'Para: Juan Carlos Perez', hora: '21:59',
};

/** Todo dibujo cae dentro del lienzo y los textos dentro del marco. */
function dentro(m: Maqueta, margenMm = 0) {
  const minimo = Math.max(8, Math.round(margenMm * 8));
  for (const p of m.primitivas as Primitiva[]) {
    if (p.t === 'texto') {
      const f = FUENTES_TSPL[p.fuente];
      expect(p.x, p.texto).toBeGreaterThanOrEqual(minimo);
      expect(p.y, p.texto).toBeGreaterThanOrEqual(minimo);
      expect(p.x + p.texto.length * f.ancho * p.xm, p.texto).toBeLessThanOrEqual(m.W - minimo);
      expect(p.y + f.alto * p.ym, p.texto).toBeLessThanOrEqual(m.H - minimo);
    } else if (p.t === 'barra' || p.t === 'inverso') {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(m.W);
      expect(p.y + p.h).toBeLessThanOrEqual(m.H);
    } else if (p.t === 'caja') {
      expect(p.x1).toBeGreaterThanOrEqual(0);
      expect(p.y1).toBeGreaterThanOrEqual(0);
      expect(p.x2).toBeLessThanOrEqual(m.W);
      expect(p.y2).toBeLessThanOrEqual(m.H);
    }
  }
}

describe('tamaño por PC: el diseño se adapta y nada se sale del borde', () => {
  it.each(PRESETS_TAMANO_ETIQUETA.map((p) => [p.nombre, p] as const))('%s: bebida y general con datos largos caben, con y sin margen', (_n, p) => {
    for (const margenMm of [0, 3]) {
      const mb = maquetarBebida(bebida, { anchoMm: p.anchoMm, altoMm: p.altoMm, margenMm });
      expect(mb.W).toBe(Math.round(p.anchoMm * 8));
      expect(mb.H).toBe(Math.round(p.altoMm * 8));
      dentro(mb, margenMm);
      const mg = maquetarGeneral(general, { anchoMm: p.anchoMm, altoMm: p.altoMm, margenMm });
      dentro(mg, margenMm);
    }
  });

  it('en vertical (alto mayor que ancho) y en 50 x 30 apaisado también cabe', () => {
    for (const t of [{ anchoMm: 30, altoMm: 50 }, { anchoMm: 63.5, altoMm: 101.6 }, { anchoMm: 50, altoMm: 30 }]) {
      dentro(maquetarBebida(bebida, t));
      dentro(maquetarGeneral(general, t));
    }
  });

  it('el logo y los textos escalan con el tamaño: más grande, letra más grande', () => {
    const alturaMax = (m: Maqueta) =>
      Math.max(...(m.primitivas as Primitiva[]).filter((p): p is Extract<Primitiva, { t: 'texto' }> => p.t === 'texto').map((p) => FUENTES_TSPL[p.fuente].alto * p.ym));
    expect(alturaMax(maquetarBebida(bebida, { anchoMm: 100, altoMm: 100 }))).toBeGreaterThanOrEqual(alturaMax(maquetarBebida(bebida, { anchoMm: 50, altoMm: 30 })));
  });

  it('el margen propio ensancha el marco', () => {
    const marco = (m: Maqueta) => (m.primitivas as Primitiva[]).find((p) => p.t === 'caja') as Extract<Primitiva, { t: 'caja' }>;
    expect(marco(maquetarBebida(bebida, { anchoMm: 76, altoMm: 38, margenMm: 4 })).x1).toBe(32);
    expect(marco(maquetarBebida(bebida, { anchoMm: 76, altoMm: 38 })).x1).toBeLessThan(32);
  });
});

describe('tamaño por PC: reemplaza al general solo allí', () => {
  it('sin valor propio (o inválido) hereda el general del local', () => {
    expect(tamanoEfectivo(null, TAMANO_BEBIDA_DEFECTO)).toEqual(TAMANO_BEBIDA_DEFECTO);
    expect(tamanoEfectivo({ anchoMm: 10, altoMm: 40 }, TAMANO_BEBIDA_DEFECTO)).toEqual(TAMANO_BEBIDA_DEFECTO);
  });

  it('con valor propio manda el propio, con su orientación y margen', () => {
    expect(tamanoEfectivo({ anchoMm: 60, altoMm: 40 }, TAMANO_BEBIDA_DEFECTO)).toEqual({ anchoMm: 60, altoMm: 40 });
    expect(tamanoEfectivo({ anchoMm: 60, altoMm: 40, orientacion: 'vertical', margenMm: 2 }, TAMANO_BEBIDA_DEFECTO)).toEqual({ anchoMm: 40, altoMm: 60, orientacion: 'vertical', margenMm: 2 });
    expect(aplicarOrientacion({ anchoMm: 40, altoMm: 60, orientacion: 'apaisado' })).toMatchObject({ anchoMm: 60, altoMm: 40 });
  });

  it('valida 30-200 mm y margen 0-10 mm', () => {
    expect(tamanoPcValido({ anchoMm: 101.6, altoMm: 63.5 })).toEqual({ anchoMm: 101.6, altoMm: 63.5 });
    expect(tamanoPcValido({ anchoMm: 29, altoMm: 40 })).toBeNull();
    expect(tamanoPcValido({ anchoMm: 201, altoMm: 40 })).toBeNull();
    expect(tamanoPcValido({ anchoMm: 60, altoMm: 40, margenMm: 11 })).toEqual({ anchoMm: 60, altoMm: 40 });
  });
});
