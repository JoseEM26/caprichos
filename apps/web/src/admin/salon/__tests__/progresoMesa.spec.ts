import { describe, it, expect } from 'vitest';
import { juntarProgresos, progresoDePiezas } from '../progresoMesa';
import type { ProgresoPedido } from '../tipos';

export const progDe = (areas: Array<[string, Array<[number, number]>]>): ProgresoPedido =>
  ({
    etapa: 'EN_COCINA',
    etiqueta: '',
    listasDe: 0,
    totalAreas: areas.length,
    porcentaje: 0,
    enCamino: false,
    areas: areas.map(([nombre, ps]) => ({
      nombre,
      estado: 'PREPARANDO' as const,
      lineas: ps.length,
      productos: ps.map(([cantidad, listas]) => ({ nombre: 'x', cantidad, listas })),
    })),
  }) as ProgresoPedido;

describe('progresoMesa', () => {
  it('suma piezas listas entre áreas', () => {
    const p = progresoDePiezas(progDe([['Cocina', [[2, 1], [1, 1]]], ['Bebidas', [[3, 0]]]]));
    expect(p).toMatchObject({ total: 6, listas: 2, porcentaje: 33 });
    expect(p.porArea).toEqual([
      { nombre: 'Cocina', total: 3, listas: 2 },
      { nombre: 'Bebidas', total: 3, listas: 0 },
    ]);
  });
  it('no pasa de la cantidad aunque listas sobre', () => {
    expect(progresoDePiezas(progDe([['Cocina', [[2, 5]]]])).porcentaje).toBe(100);
  });
  it('anulado, sin progreso y sin piezas dan 0', () => {
    expect(progresoDePiezas(undefined).total).toBe(0);
    expect(progresoDePiezas(progDe([['Cocina', [[2, 2]]]]), 'ANULADO').total).toBe(0);
    expect(progresoDePiezas(progDe([])).porcentaje).toBe(0);
  });
  it('usa el progreso de la API si ya trae total y listas', () => {
    const p = { ...progDe([['Cocina', [[9, 0]]]]), total: 4, listas: 3, porArea: [{ nombre: 'Cocina', total: 4, listas: 3 }] };
    expect(progresoDePiezas(p as unknown as ProgresoPedido)).toMatchObject({ total: 4, listas: 3, porcentaje: 75 });
  });
  it('junta original y extras agrupando por área', () => {
    const a = progresoDePiezas(progDe([['Cocina', [[2, 2]]]]));
    const b = progresoDePiezas(progDe([['Cocina', [[2, 0]]], ['Bebidas', [[1, 1]]]]));
    const j = juntarProgresos([a, b]);
    expect(j).toMatchObject({ total: 5, listas: 3, porcentaje: 60 });
    expect(j.porArea.find((x) => x.nombre === 'Cocina')).toEqual({ nombre: 'Cocina', total: 4, listas: 2 });
  });
});
