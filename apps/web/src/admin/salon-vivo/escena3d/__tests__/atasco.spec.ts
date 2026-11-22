import { describe, expect, it } from 'vitest';
import { ATASCO_SEGUNDOS, PROGRESO_MIN, rastroNuevo, repartirSillas, revisarAtasco } from '../atasco';

describe('reparto de sillas', () => {
  it('nunca más personas que sillas libres', () => {
    expect(repartirSillas(3, 4)).toEqual({ sillas: [0, 1, 2], dePie: 0 });
    expect(repartirSillas(6, 4)).toEqual({ sillas: [0, 1, 2, 3], dePie: 2 });
  });
  it('salta las sillas ocupadas', () => {
    expect(repartirSillas(2, 4, new Set([0, 2]))).toEqual({ sillas: [1, 3], dePie: 0 });
    expect(repartirSillas(3, 4, new Set([0, 1, 2]))).toEqual({ sillas: [3], dePie: 2 });
  });
  it('sin sillas o sin personas', () => {
    expect(repartirSillas(2, 0)).toEqual({ sillas: [], dePie: 2 });
    expect(repartirSillas(0, 4)).toEqual({ sillas: [], dePie: 0 });
  });
});

describe('rescate de atascados', () => {
  it('quien avanza no se considera atascado, por lento que vaya', () => {
    let r = rastroNuevo(0);
    for (let t = 0; t < 60; t += 0.5) {
      const x = revisarAtasco(r, 20 - t * 0.5, t); // 0.25 por medio segundo
      r = x.rastro;
      expect(x.atascado).toBe(false);
    }
  });
  it('quien camina en el sitio (la distancia no baja) se rescata tras el límite', () => {
    let r = rastroNuevo(0), t = 0, rescatado = -1;
    for (; t < 30 && rescatado < 0; t += 0.1) {
      const x = revisarAtasco(r, 5 + Math.sin(t * 3) * (PROGRESO_MIN / 2), t); // se mueve pero no se acerca
      r = x.rastro;
      if (x.atascado) rescatado = t;
    }
    expect(rescatado).toBeGreaterThanOrEqual(ATASCO_SEGUNDOS);
    expect(rescatado).toBeLessThan(ATASCO_SEGUNDOS + 0.5);
  });
  it('si avanza un poco, el reloj del atasco vuelve a empezar', () => {
    let r = revisarAtasco(rastroNuevo(0), 10, 0).rastro;
    r = revisarAtasco(r, 10, 3).rastro;
    const x = revisarAtasco(r, 9, 3.5); // avanzó 1: reinicia
    expect(x.atascado).toBe(false);
    expect(revisarAtasco(x.rastro, 9, 3.5 + ATASCO_SEGUNDOS - 0.1).atascado).toBe(false);
    expect(revisarAtasco(x.rastro, 9, 3.5 + ATASCO_SEGUNDOS).atascado).toBe(true);
  });
});
