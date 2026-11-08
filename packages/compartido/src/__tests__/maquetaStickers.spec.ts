import { describe, it, expect } from 'vitest';
import {
  FUENTES_TSPL,
  TAMANO_BEBIDA_DEFECTO,
  TAMANO_GENERAL_DEFECTO,
  maquetarBebida,
  maquetarEtiqueta,
  maquetarGeneral,
  medidaEtiquetaValida,
  tamanosDesdeValores,
} from '../index.js';
import type { EtiquetaBebidaDatos, EtiquetaGeneralDatos, Maqueta, Primitiva } from '../index.js';

const largo = 'ADMINISTRACION INTERNACIONAL DE EMPRESAS';

const general = (n: number, extra: Partial<EtiquetaGeneralDatos> = {}): EtiquetaGeneralDatos => ({
  codigo: 'CP-W999', modalidad: 'Delivery', modalidadPill: 'DELIVERY', who: 'Jose Espinoza', canal: 'WhatsApp', hora: '21:59', fecha: '07/11/2026',
  cantidadProductos: n, total: 123.5, printer: 'Etiquetera de caja',
  productos: Array.from({ length: n }, (_, i) => ({ cantidad: 1 + (i % 3), nombre: `Producto ${i + 1} ${largo}`, tamano: i % 2 ? '12oz' : null })),
  ...extra,
});

const bebida = (extra: Partial<EtiquetaBebidaDatos> = {}): EtiquetaBebidaDatos => ({
  bebidaIndex: 1, totalBebidas: 3, codigo: 'CP-W999', persona: 'Maria', bebidaNombre: 'Cappuccino', tamano: '12oz',
  opciones: ['Leche de avena', 'Sin azucar'], contiene: 'Avena, canela', who: 'Para: Juan', hora: '21:59', ...extra,
});

/** Todo dibujo cae dentro del lienzo y los textos dentro del marco; devuelve los textos. */
function verificarDentro(m: Maqueta): string[] {
  const textos: string[] = [];
  for (const p of m.primitivas as Primitiva[]) {
    if (p.t === 'texto') {
      const f = FUENTES_TSPL[p.fuente];
      expect(p.x, p.texto).toBeGreaterThanOrEqual(8);
      expect(p.y, p.texto).toBeGreaterThanOrEqual(8);
      expect(p.x + p.texto.length * f.ancho * p.xm, p.texto).toBeLessThanOrEqual(m.W - 8);
      expect(p.y + f.alto * p.ym, p.texto).toBeLessThanOrEqual(m.H - 8);
      textos.push(p.texto);
    } else if (p.t === 'barra' || p.t === 'inverso') {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(m.W);
      expect(p.y + p.h).toBeLessThanOrEqual(m.H);
    }
  }
  return textos;
}

/** Ninguna linea de texto pisa a otra: las cajas (x, y, ancho, alto) de los textos no se cruzan. */
function sinSolapes(m: Maqueta) {
  const cajas = (m.primitivas as Primitiva[]).flatMap((p) =>
    p.t === 'texto' && !p.invertido
      ? [{ t: p.texto, x1: p.x, y1: p.y, x2: p.x + p.texto.length * FUENTES_TSPL[p.fuente].ancho * p.xm, y2: p.y + FUENTES_TSPL[p.fuente].alto * p.ym }]
      : [],
  );
  for (let i = 0; i < cajas.length; i++) {
    for (let j = i + 1; j < cajas.length; j++) {
      const a = cajas[i], b = cajas[j];
      const cruza = a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
      expect(cruza, `${a.t} / ${b.t}`).toBe(false);
    }
  }
}

describe('tamano de los stickers', () => {
  it('de fabrica: bebida 76 x 38 mm y general 100 x 100 mm', () => {
    expect(TAMANO_BEBIDA_DEFECTO).toEqual({ anchoMm: 76, altoMm: 38 });
    expect(TAMANO_GENERAL_DEFECTO).toEqual({ anchoMm: 100, altoMm: 100 });
    expect(tamanosDesdeValores({})).toEqual({ bebida: { anchoMm: 76, altoMm: 38 }, general: { anchoMm: 100, altoMm: 100 } });
  });

  it('valores invalidos caen al de fabrica; los validos se respetan', () => {
    const t = tamanosDesdeValores({
      impresion_etiqueta_bebida_ancho_mm: 100, impresion_etiqueta_bebida_alto_mm: 100,
      impresion_etiqueta_general_ancho_mm: 20, impresion_etiqueta_general_alto_mm: 'x',
    });
    expect(t.bebida).toEqual({ anchoMm: 100, altoMm: 100 });
    expect(t.general).toEqual({ anchoMm: 100, altoMm: 100 });
    expect([29, 201, 50.5, '50', NaN].some(medidaEtiquetaValida)).toBe(false);
    expect([30, 76, 200].every(medidaEtiquetaValida)).toBe(true);
  });

  it('el lienzo mide exactamente el sticker (8 dots por mm), sin girar', () => {
    expect(maquetarBebida(bebida())).toMatchObject({ W: 608, H: 304 });
    expect(maquetarGeneral(general(3))).toMatchObject({ W: 800, H: 800 });
    expect(maquetarBebida(bebida(), { anchoMm: 100, altoMm: 100 })).toMatchObject({ W: 800, H: 800 });
    expect(maquetarEtiqueta('ETIQUETA_GENERAL', general(1), { anchoMm: 120, altoMm: 80 })).toMatchObject({ W: 960, H: 640 });
  });
});

describe('sticker de bebida', () => {
  const tamanos = [{ anchoMm: 76, altoMm: 38 }, { anchoMm: 100, altoMm: 100 }, { anchoMm: 50, altoMm: 30 }, { anchoMm: 60, altoMm: 60 }];

  it.each(tamanos)('cabe en %o con datos normales y con textos enormes', (t) => {
    for (const d of [
      bebida(),
      bebida({
        persona: 'MARIA ELENA GUADALUPE DEL CARMEN DE LOS SANTOS', bebidaNombre: `CAPPUCCINO VAINILLA CARAMELO ${largo}`,
        opciones: Array.from({ length: 8 }, (_, i) => `Opcion ${i} ${largo}`), contiene: largo.repeat(3),
      }),
      bebida({ tamano: null, opciones: [], contiene: null }),
    ]) {
      const m = maquetarBebida(d, t);
      expect([m.W, m.H]).toEqual([t.anchoMm * 8, t.altoMm * 8]);
      verificarDentro(m);
      sinSolapes(m);
    }
  });

  it('lleva codigo, indice 1/3, persona, bebida con tamano, opciones, cliente y hora', () => {
    const textos = verificarDentro(maquetarBebida(bebida())).join('|');
    for (const esperado of ['CP-W999', '1/3', 'MARIA', 'CAPPUCCINO', '12OZ · Leche de avena · Sin azucar', 'Para: Juan', '21:59']) {
      expect(textos).toContain(esperado);
    }
  });

  it('en 76 x 38 la letra nunca baja de la fuente 2 (7 pt) y la persona se lee grande', () => {
    const m = maquetarBebida(bebida({ opciones: Array.from({ length: 6 }, (_, i) => `Extra numero ${i}`) }));
    const fuentes = (m.primitivas as Primitiva[]).flatMap((p) => (p.t === 'texto' ? [p.fuente] : []));
    expect(fuentes.every((f) => f !== '1')).toBe(true);
    const maria = (m.primitivas as Primitiva[]).find((p) => p.t === 'texto' && p.texto === 'MARIA');
    expect(maria && maria.t === 'texto' && FUENTES_TSPL[maria.fuente].alto * maria.ym).toBeGreaterThanOrEqual(64);
  });

  it('es determinista', () => {
    expect(JSON.stringify(maquetarBebida(bebida()))).toBe(JSON.stringify(maquetarBebida(bebida())));
  });
});

describe('sticker general', () => {
  const tamanos = [{ anchoMm: 100, altoMm: 100 }, { anchoMm: 76, altoMm: 38 }, { anchoMm: 80, altoMm: 120 }, { anchoMm: 60, altoMm: 60 }];

  it.each([1, 12, 40, 120])('pedido de %i lineas cabe en 100 x 100 sin desbordar ni pisarse', (n) => {
    const m = maquetarGeneral(general(n, { direccion: `Av. Larga ${largo} 123, Miraflores`, telefono: '987654321', nota: largo.repeat(4) }));
    const textos = verificarDentro(m);
    sinSolapes(m);
    // codigo, cliente y modalidad nunca se pierden
    expect(textos).toContain('CP-W999');
    expect(textos).toContain('DELIVERY');
    expect(textos.join('|')).toMatch(/JOSE.*ESPINOZA/);
  });

  it.each(tamanos)('cabe en %o aunque sea muy distinto (40 lineas)', (t) => {
    const m = maquetarGeneral(general(40, { direccion: largo, telefono: '987654321' }), t);
    verificarDentro(m);
    sinSolapes(m);
  });

  it('pocas lineas: todas se leen, sin "+ N mas"; 120: baja la letra y al final avisa cuantas faltan', () => {
    const pocos = verificarDentro(maquetarGeneral(general(3)));
    expect(pocos.filter((t) => /x Producto/.test(t))).toHaveLength(3);
    expect(pocos.some((t) => t.startsWith('+ '))).toBe(false);

    const muchos = maquetarGeneral(general(120));
    const tx = verificarDentro(muchos);
    const mas = tx.find((t) => t.startsWith('+ '));
    expect(mas).toMatch(/^\+ \d+ MAS \(\d+ UNID\.\)$/);
    const mostrados = tx.filter((t) => /^\d+ x /.test(t)).length;
    expect(mostrados + Number(mas!.match(/\d+/)![0])).toBe(120);
    // el total de unidades siempre esta
    expect(tx).toContain('S/ 123.50');
    expect(tx.some((t) => /UNID\./.test(t))).toBe(true);
  });

  it('delivery lleva direccion y celular; sin ellos no hay esas lineas', () => {
    const con = verificarDentro(maquetarGeneral(general(2, { direccion: 'Jr. Union 45', telefono: '999888777' })));
    expect(con).toContain('DIR: Jr. Union 45');
    expect(con).toContain('TEL: 999888777');
    const sin = verificarDentro(maquetarGeneral(general(2)));
    expect(sin.some((t) => t.startsWith('DIR:') || t.startsWith('TEL:'))).toBe(false);
  });

  it('delivery con coordenadas imprime la linea PLUS dentro del ancho; sin ellas no', () => {
    const con = verificarDentro(maquetarGeneral(general(2, { direccion: 'Jr. Union 45', telefono: '999888777', plus: '7P7J+2X Lima' })));
    expect(con).toContain('PLUS: 7P7J+2X Lima');
    expect(verificarDentro(maquetarGeneral(general(2, { telefono: '999888777' }))).some((t) => t.startsWith('PLUS:'))).toBe(false);
  });

  it('nombre de cliente largo se reparte o se recorta, pero cabe', () => {
    const m = maquetarGeneral(general(2, { who: 'MARIA ELENA GUADALUPE DEL CARMEN DE LOS SANTOS PEREZ' }));
    verificarDentro(m);
    sinSolapes(m);
  });
});
