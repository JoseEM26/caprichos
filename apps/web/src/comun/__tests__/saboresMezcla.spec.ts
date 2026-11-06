import { describe, it, expect } from 'vitest';
import {
  aArreglo,
  aReparto,
  faltanUnidades,
  maximoMezclas,
  recortarAlTope,
  repartoValido,
  resumenMezcla,
  todasDeUn,
  topeParaSabor,
  totalElegido,
} from '../saboresMezcla';

const sabores = [
  { id: 'f', nombre: 'Fresa', disponible: true, quedan: 4 },
  { id: 'o', nombre: 'Oreo', disponible: true, quedan: null },
  { id: 'm', nombre: 'Manjar', disponible: true, quedan: 1 },
];

describe('reparto de sabores', () => {
  it('suma las unidades elegidas e ignora ceros', () => {
    expect(totalElegido({ f: 2, o: 3, m: 0 })).toBe(5);
    expect(faltanUnidades({ f: 2 }, 6)).toBe(4);
    expect(faltanUnidades({ f: 9 }, 6)).toBe(0);
  });

  it('válido solo si suma exacto, enteros, sabores conocidos y dentro del tope', () => {
    expect(repartoValido({ f: 2, o: 3, m: 1 }, 6, sabores)).toBe(true);
    expect(repartoValido({ f: 2, o: 3 }, 6, sabores)).toBe(false); // falta uno
    expect(repartoValido({ f: 4, o: 3 }, 6, sabores)).toBe(false); // suma 7
    expect(repartoValido({ m: 2, o: 4 }, 6, sabores)).toBe(false); // Manjar solo queda 1
    expect(repartoValido({ x: 6 }, 6, sabores)).toBe(false); // sabor desconocido
    expect(repartoValido({ o: 1.5, f: 4.5 }, 6, sabores)).toBe(false);
    expect(repartoValido({}, 0, sabores)).toBe(false);
  });

  it('recorta cada sabor a lo que queda y la suma al total, sin tocar lo que cabe', () => {
    expect(recortarAlTope({ f: 6, o: 2 }, sabores, 6)).toEqual({ f: 4, o: 2 });
    expect(recortarAlTope({ m: 3, o: 5 }, sabores, 6)).toEqual({ m: 1, o: 5 });
    expect(recortarAlTope({ f: 2, o: 2, m: 2 }, sabores, 3)).toEqual({ f: 2, o: 1 });
  });

  it('quita del reparto un sabor que ya no está en la lista', () => {
    const sinFresa = sabores.filter((s) => s.id !== 'f');
    expect(recortarAlTope({ f: 2, o: 2 }, sinFresa, 6)).toEqual({ o: 2 });
  });

  it('tope por sabor: lo que cabe según el total y lo que queda', () => {
    expect(topeParaSabor({ f: 2, o: 3 }, 'f', sabores[0], 6)).toBe(3); // 6-3 en otros; quedan 4 → 3
    expect(topeParaSabor({ f: 2, o: 3 }, 'o', sabores[1], 6)).toBe(4); // sin tope propio → 6-2
    expect(topeParaSabor({ m: 1 }, 'm', sabores[2], 6)).toBe(1);
  });

  it('todas del mismo sabor y a arreglo ida y vuelta', () => {
    expect(todasDeUn('o', 12)).toEqual({ o: 12 });
    const arreglo = aArreglo({ f: 2, o: 0, m: 1 });
    expect(arreglo).toEqual([
      { saborId: 'f', cantidad: 2 },
      { saborId: 'm', cantidad: 1 },
    ]);
    expect(aReparto(arreglo)).toEqual({ f: 2, m: 1 });
  });

  it('máximo de mezclas: suma de lo disponible entre unidades por mezcla; sin tope si un sabor no tiene', () => {
    const conTope = [
      { id: 'a', nombre: 'A', disponible: true, quedan: 7 },
      { id: 'b', nombre: 'B', disponible: true, quedan: 5 },
      { id: 'c', nombre: 'C', disponible: false, quedan: 50 },
    ];
    expect(maximoMezclas(conTope, 6)).toBe(2);
    expect(maximoMezclas(conTope, 12)).toBe(1);
    expect(maximoMezclas([...conTope, { id: 'd', nombre: 'D', disponible: true, quedan: null }], 6)).toBeNull();
  });

  it('resumen legible de la mezcla', () => {
    expect(resumenMezcla([{ saborId: 'f', cantidad: 2 }, { saborId: 'o', cantidad: 3 }, { saborId: 'm', cantidad: 1 }], { f: 'Fresa', o: 'Oreo', m: 'Manjar' })).toBe(
      '2 Fresa · 3 Oreo · 1 Manjar',
    );
  });
});
