import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { generarTsplTrabajo } from '../generadorTspl';
import { formatoDesdeConfig, resolverFormato } from '../formato';
import { ANCHO_CABEZAL_MM } from '@caprichos/compartido';
import { muestraEtiquetaArea, muestraEtiquetaGeneral, muestraEtiquetaBebida } from '../../datosMuestra';

// Geometria de un script TSPL: rectangulos de BOX/BAR/REVERSE/BITMAP y texto sin girar (rot 0).
const FUENTE: Record<string, [number, number]> = { '1': [8, 12], '2': [12, 20], '3': [16, 24], '4': [24, 32], '5': [32, 48] };
type R = { nombre: string; x1: number; y1: number; x2: number; y2: number };

function geometria(script: string) {
  const size = /SIZE ([\d.]+) mm,([\d.]+) mm/.exec(script)!;
  const W = Math.round(Number(size[1]) * 8);
  const H = Math.round(Number(size[2]) * 8);
  const rects: R[] = [];
  const textos: R[] = [];
  const bitmaps: R[] = [];
  const re = /BITMAP (\d+),(\d+),(\d+),(\d+),0,/g;
  let pos = 0;
  while (pos < script.length) {
    re.lastIndex = pos;
    const mb = re.exec(script);
    const nl = script.indexOf('\n', pos);
    if (mb && mb.index === pos) {
      const [x, y, wb, h] = mb.slice(1).map(Number);
      bitmaps.push({ nombre: 'BITMAP', x1: x, y1: y, x2: x + wb * 8, y2: y + h });
      pos = mb.index + mb[0].length + wb * h;
      continue;
    }
    if (nl < 0) break;
    const linea = script.slice(pos, nl).replace(/\r$/, '');
    let m: RegExpExecArray | null;
    if ((m = /^BOX (\d+),(\d+),(\d+),(\d+)/.exec(linea))) rects.push({ nombre: 'BOX', x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] });
    else if ((m = /^BAR (\d+),(\d+),(\d+),(\d+)/.exec(linea))) rects.push({ nombre: 'BAR', x1: +m[1], y1: +m[2], x2: +m[1] + +m[3], y2: +m[2] + +m[4] });
    else if ((m = /^REVERSE (\d+),(\d+),(\d+),(\d+)/.exec(linea))) rects.push({ nombre: 'REVERSE', x1: +m[1], y1: +m[2], x2: +m[1] + +m[3], y2: +m[2] + +m[4] });
    else if ((m = /^TEXT (\d+),(\d+),"(\w)",(\d+),(\d+),(\d+),"(.*)"$/.exec(linea)) && m[4] === '0') {
      const [aw, ah] = FUENTE[m[3]];
      const xm = +m[5];
      const ym = +m[6];
      textos.push({ nombre: `TEXT "${m[7]}"`, x1: +m[1], y1: +m[2], x2: +m[1] + m[7].length * aw * xm, y2: +m[2] + ah * ym });
    }
    pos = nl + 1;
  }
  return { W, H, rects, textos, bitmaps };
}

const toca = (a: R, b: R) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** Todo lo que el script dibuja (sin girar) cabe dentro del SIZE y del cabezal. */
function expectDentro(script: string, anchoCabezal = ANCHO_CABEZAL_MM * 8) {
  const g = geometria(script);
  expect(g.W).toBeLessThanOrEqual(anchoCabezal);
  for (const r of [...g.rects, ...g.textos, ...g.bitmaps]) {
    expect(r.x1, r.nombre).toBeGreaterThanOrEqual(0);
    expect(r.y1, r.nombre).toBeGreaterThanOrEqual(0);
    expect(r.x2, `${r.nombre} x2 ${r.x2} > ${g.W}`).toBeLessThanOrEqual(g.W);
    expect(r.y2, `${r.nombre} y2 ${r.y2} > ${g.H}`).toBeLessThanOrEqual(g.H);
  }
  return g;
}

/** El logo (BITMAP) no toca ningun texto. */
function expectLogoLibre(script: string) {
  const g = geometria(script);
  for (const b of g.bitmaps) for (const t of g.textos) expect(toca(b, t), `${t.nombre} toca el logo`).toBe(false);
}

const huella = (s: string) => createHash('sha256').update(Buffer.from(s, 'latin1')).digest('hex').slice(0, 16);

const general = (anchoMm: number, altoMm: number, orientacion?: 'vertical') =>
  generarTsplTrabajo('ETIQUETA_GENERAL', { ...muestraEtiquetaGeneral, tamanoMm: { anchoMm, altoMm } } as any, false, resolverFormato(orientacion ? { orientacion } : {}));

describe('sin cambio en el formato por defecto (hashes del TSPL que ya sale)', () => {
  it('area vertical-girado 101.6 x 63.5 (giro 90 y 270), horizontal 101.6 x 63.5, general 100 x 100 y bebida 76 x 38', () => {
    expect(huella(generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, formatoDesdeConfig({})))).toBe('953d84ee867d14ab');
    expect(huella(generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, resolverFormato({ giro: 270 })))).toBe('1b9310370d4ec659');
    expect(huella(generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, resolverFormato({ orientacion: 'horizontal' })))).toBe('bde5c3a4b4a319ec');
    expect(huella(generarTsplTrabajo('ETIQUETA_GENERAL', muestraEtiquetaGeneral, false, formatoDesdeConfig({})))).toBe('ab95d88af6aea8a6');
    expect(huella(generarTsplTrabajo('ETIQUETA_BEBIDA', muestraEtiquetaBebida, false, formatoDesdeConfig({})))).toBe('2dd19702a30c1402');
  });
});

describe('ancho que la etiquetera no imprime', () => {
  it('115 mm apaisado se rechaza con el tope del cabezal (no sale cortado ni cae al tamaño de fabrica)', () => {
    expect(() => general(115, 59.8)).toThrow(/115 mm.*104 mm/);
  });
  it('el cabezal de 104 mm es el tope de la constante', () => {
    expect(ANCHO_CABEZAL_MM).toBe(104);
  });
});

describe('tamaños personalizados validos: todo cabe en SIZE y en el cabezal', () => {
  it('general 104 x 59.8 apaisado (el maximo del cabezal), sin texto encima del logo', () => {
    const s = general(104, 59.8);
    expect(geometria(s).W).toBe(832);
    expectDentro(s);
    expectLogoLibre(s);
  });
  it('general 60 x 100 vertical', () => {
    const s = general(60, 100, 'vertical');
    expect(geometria(s).W).toBe(480);
    expectDentro(s);
    expectLogoLibre(s);
  });
  it('general 60 x 100 apaisado (ancho 60, alto 100): el alto no tiene limite de cabezal', () => {
    expectDentro(general(60, 100));
  });
  it('area 60 x 100 de rollo de canto (vertical): ningun BOX ni texto se sale del lienzo', () => {
    const s = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, resolverFormato({ orientacion: 'vertical', anchoMm: 60, altoMm: 100 }));
    expect(geometria(s).W).toBe(480);
    expect(geometria(s).H).toBe(800);
    expectDentro(s);
  });
  it('area 101.6 x 63.5 de canto (vertical): dentro de 508 x 813', () => {
    const s = generarTsplTrabajo('ETIQUETA_AREA', muestraEtiquetaArea, false, resolverFormato({ orientacion: 'vertical' }));
    expectDentro(s);
    expectLogoLibre(s);
  });
});
