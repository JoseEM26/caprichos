import { describe, expect, it } from 'vitest';
import {
  ajustarAVecinas, areaSolapeM2, areaM2, separacionM, insertarVertice, quitarVerticeDe, ladoMasLargo, resumenAjusteTexto,
  solapeEntre, recortarSolape, type Punto,
} from '../utilidades/geometria-zonas.js';

const LAT0 = -12;
const KX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110574;
/** Rectángulo en metros (x este, y norte) -> [lat, lng] */
const rect = (x0: number, y0: number, x1: number, y1: number): Punto[] =>
  [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => [LAT0 + y / KY, -77 + x / KX] as Punto);

describe('solape y separacion', () => {
  it('bordes compartidos no son solape', () => {
    expect(areaSolapeM2(rect(0, 0, 100, 100), rect(100, 0, 200, 100))).toBeLessThan(0.01);
  });
  it('solape parcial mide el area', () => {
    expect(areaSolapeM2(rect(0, 0, 100, 100), rect(90, 0, 200, 100))).toBeCloseTo(1000, 0);
  });
  it('contenido totalmente da el area menor', () => {
    expect(areaSolapeM2(rect(0, 0, 100, 100), rect(20, 20, 40, 40))).toBeCloseTo(400, 0);
  });
  it('separacion de un hueco', () => {
    expect(separacionM(rect(0, 0, 100, 100), rect(106, 0, 200, 100))).toBeCloseTo(6, 1);
  });
});

describe('solapeEntre y recortarSolape', () => {
  it('sin solape: area 0 y ningun anillo', () => {
    const r = solapeEntre(rect(0, 0, 100, 100), rect(100, 0, 200, 100));
    expect(r.areaM2).toBeLessThan(0.01);
    expect(r.anillos).toEqual([]);
  });
  it('solape parcial: el anillo cubre la franja compartida', () => {
    const r = solapeEntre(rect(0, 0, 100, 100), rect(90, 0, 200, 100));
    expect(r.areaM2).toBeCloseTo(1000, 0);
    expect(r.anillos).toHaveLength(1);
    expect(areaM2(r.anillos[0])).toBeCloseTo(1000, 0);
    expect(areaSolapeM2(r.anillos[0], rect(90, 0, 100, 100))).toBeCloseTo(1000, 0);
  });
  it('recortarSolape deja a la zona sin la parte compartida', () => {
    const r = recortarSolape(rect(90, 0, 200, 100), rect(0, 0, 100, 100));
    expect(r).not.toBeNull();
    expect(areaM2(r!)).toBeCloseTo(10000, 0);
    expect(areaSolapeM2(r!, rect(0, 0, 100, 100))).toBeLessThan(0.5);
  });
  it('recortarSolape sin solape devuelve el mismo poligono', () => {
    const p = rect(100, 0, 200, 100);
    expect(recortarSolape(p, rect(0, 0, 100, 100))).toBe(p);
  });
  it('recortarSolape con la otra zona dentro deja hueco: null', () => {
    expect(recortarSolape(rect(0, 0, 100, 100), rect(20, 20, 40, 40))).toBeNull();
  });
});

describe('ajustarAVecinas', () => {
  const vecina = rect(0, 0, 100, 100);

  it('pega vertices a vertice vecino y cierra el hueco', () => {
    const r = ajustarAVecinas(rect(106, 0, 200, 100), [vecina], 15);
    expect(r.cambio).toBe(true);
    expect(r.resumen.verticesAjustados).toBe(2);
    expect(r.resumen.huecosCerrados).toBe(1);
    expect(separacionM(r.poligono, vecina)).toBeLessThan(0.01);
    expect(areaSolapeM2(r.poligono, vecina)).toBeLessThan(0.1);
  });

  it('pega un vertice a un lado ajeno y lo inserta en el propio', () => {
    // vecina con un vertice a mitad de su lado derecho; la propia queda a 5 m sin vertices alli
    const v = [...rect(0, 0, 100, 100)];
    v.splice(2, 0, [LAT0 + 50 / KY, -77 + 100 / KX]);
    const propia: Punto[] = rect(105, 0, 200, 100);
    // vertice (105,0) esta a 5 m del lado de la vecina: se proyecta; los vertices de la vecina en x=100 se insertan
    const r = ajustarAVecinas(propia, [v], 15);
    expect(r.resumen.verticesAjustados).toBe(2);
    expect(separacionM(r.poligono, v)).toBeLessThan(0.01);
  });

  it('proyecta sobre un lado cuando no hay vertice cercano', () => {
    const propia: Punto[] = [[0, 0], [100, 0], [100, 100], [0, 100]]
      .map(([x, y]) => [LAT0 + y / KY, -77 + (x + 100 + 4) / KX] as Punto);
    propia[0] = [LAT0 + 40 / KY, -77 + 104 / KX]; // a 4 m del lado, a 40 m de vertices vecinos
    const r = ajustarAVecinas(propia, [vecina], 15);
    expect(r.resumen.verticesAjustados).toBeGreaterThanOrEqual(1);
  });

  it('recorta un solape pequeno', () => {
    const r = ajustarAVecinas(rect(97, 0, 200, 100), [vecina], 2);
    // 3 m de solape, tolerancia 2: no hay snap, se recorta
    expect(r.resumen.areaRecortadaM2).toBeGreaterThan(250);
    expect(areaSolapeM2(r.poligono, vecina)).toBeLessThan(0.5);
  });

  it('respeta la tolerancia (hueco grande se conserva)', () => {
    const lejos = rect(140, 0, 200, 100);
    const r = ajustarAVecinas(lejos, [vecina], 15);
    expect(r.cambio).toBe(false);
    expect(r.poligono).toBe(lejos);
  });

  it('un poligono ya correcto no cambia', () => {
    const p = rect(100, 0, 200, 100);
    const r = ajustarAVecinas(p, [vecina], 15);
    expect(r.cambio).toBe(false);
  });

  it('es idempotente', () => {
    const una = ajustarAVecinas(rect(106, -3, 200, 100), [vecina], 15);
    const dos = ajustarAVecinas(una.poligono, [vecina], 15);
    expect(dos.cambio).toBe(false);
    const solape = ajustarAVecinas(rect(90, 0, 200, 100), [vecina], 15);
    expect(areaSolapeM2(solape.poligono, vecina)).toBeLessThan(0.5);
    expect(ajustarAVecinas(solape.poligono, [vecina], 15).cambio).toBe(false);
  });

  it('resumen en texto', () => {
    const r = ajustarAVecinas(rect(106, 0, 200, 100), [vecina], 15);
    expect(resumenAjusteTexto(r.resumen)).toMatch(/pegaron 2 vértices/);
    expect(areaM2(r.poligono)).toBeGreaterThan(9000);
  });
});

describe('edicion de vertices', () => {
  const p = rect(0, 0, 100, 50);
  it('inserta en el orden correcto del anillo', () => {
    const r = insertarVertice(p, 1);
    expect(r).toHaveLength(5);
    expect(r[0]).toEqual(p[0]);
    expect(r[1]).toEqual(p[1]);
    expect(r[3]).toEqual(p[2]);
    const ult = insertarVertice(p, 3);
    expect(ult).toHaveLength(5);
    expect(ult[4][0]).toBeCloseTo((p[3][0] + p[0][0]) / 2, 9);
  });
  it('lado mas largo', () => expect(ladoMasLargo(p)).toBe(0));
  it('quitar respeta el minimo de 3', () => {
    expect(quitarVerticeDe(p, 0)).toHaveLength(3);
    expect(quitarVerticeDe(quitarVerticeDe(p, 0), 0)).toHaveLength(3);
  });
});
