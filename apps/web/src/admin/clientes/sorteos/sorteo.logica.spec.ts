import { describe, it, expect } from 'vitest';
import { azarSeguro, barajar, nEsimo, topK, eliminacion, gajosRuleta, elegir, type Azar } from './sorteo.logica';

// Generador sembrado (mulberry32) para inyectar
function semilla(s: number): Azar {
  return (max) => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}
const xs = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('azarSeguro', () => {
  it('queda en [0,max) y cubre todos los valores', () => {
    const vistos = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = azarSeguro(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      vistos.add(v);
    }
    expect(vistos.size).toBe(5);
  });
  it('rechaza max inválido', () => {
    expect(() => azarSeguro(0)).toThrow();
    expect(() => azarSeguro(1.5)).toThrow();
  });
});

describe('barajar / elegir', () => {
  it('es una permutación y no toca el original', () => {
    const r = barajar(xs, semilla(1));
    expect([...r].sort()).toEqual(xs);
    expect(xs).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('elegir es uniforme con rng inyectado (3 opciones)', () => {
    const az = semilla(42);
    const c: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 30000; i++) c[elegir(['a', 'b', 'c'], az)]++;
    for (const k of Object.keys(c)) expect(Math.abs(c[k] - 10000)).toBeLessThan(500);
  });
  it('barajar: cada permutación de 3 sale ~1/6', () => {
    const az = semilla(7);
    const c = new Map<string, number>();
    for (let i = 0; i < 30000; i++) {
      const k = barajar([1, 2, 3], az).join('');
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    expect(c.size).toBe(6);
    for (const v of c.values()) expect(Math.abs(v - 5000)).toBeLessThan(400);
  });
});

describe('modos', () => {
  it('nEsimo: el n-ésimo gana, sin repetidos, n se ajusta', () => {
    const r = nEsimo(xs, 3, semilla(3));
    expect(r.orden).toHaveLength(3);
    expect(new Set(r.orden).size).toBe(3);
    expect(r.ganador).toBe(r.orden[2]);
    expect(nEsimo(xs, 99, semilla(3)).orden).toHaveLength(6);
    expect(nEsimo(xs, 0, semilla(3)).orden).toHaveLength(1);
  });
  it('topK: K distintos y ajustado al total', () => {
    const r = topK(xs, 3, semilla(5));
    expect(new Set(r).size).toBe(3);
    expect(topK(['x', 'y'], 10, semilla(5))).toHaveLength(2);
  });
  it('eliminacion: cubre a todos menos el ganador, en pocas rondas', () => {
    const grande = Array.from({ length: 200 }, (_, i) => i);
    const r = eliminacion(grande, semilla(9));
    expect(r.rondas.length).toBeLessThanOrEqual(8);
    const fuera = r.rondas.flat();
    expect(fuera).toHaveLength(199);
    expect(fuera).not.toContain(r.ganador);
    expect(new Set([...fuera, r.ganador]).size).toBe(200);
    expect(eliminacion(['solo'], semilla(1))).toEqual({ rondas: [], ganador: 'solo' });
  });
  it('gajosRuleta: incluye al ganador y limita el tamaño', () => {
    const grande = Array.from({ length: 100 }, (_, i) => i);
    const g = gajosRuleta(grande, 77, 24, semilla(2));
    expect(g).toHaveLength(24);
    expect(g).toContain(77);
    expect(new Set(g).size).toBe(24);
  });
});
