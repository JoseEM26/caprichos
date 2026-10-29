import { describe, it, expect } from 'vitest';
import { aProductoCarta, avisosProducto } from '../aProductoCarta';

describe('aProductoCarta', () => {
  it('convierte tamanos y filtra los inactivos', () => {
    const p = aProductoCarta({
      nombre: 'Latte',
      precio: '8.5',
      tamanos: [
        { id: 't1', nombre: 'Chico', precio: 8 },
        { id: 't2', nombre: 'Grande', precio: 12, activo: false },
      ],
    });
    expect(p.precio).toBe(8.5);
    expect(p.tamanos).toEqual([{ id: 't1', nombre: 'Chico', precio: 8 }]);
  });

  it('convierte grupos: obligatorio, maximo y opciones inactivas', () => {
    const p = aProductoCarta({
      nombre: 'X',
      grupos: [
        { id: 'g1', nombre: 'Leche', obligatorio: true, maximo: 1, opciones: [
          { id: 'o1', nombre: 'Entera', precioExtra: 0 },
          { id: 'o2', nombre: 'Avena', precioExtra: 2, activo: false },
        ] },
        { id: 'g2', nombre: 'Extras', maximo: 3, opciones: [{ id: 'o3', nombre: 'Shot', precioExtra: 3 }] },
        { id: 'g3', nombre: 'Vacío', opciones: [] },
      ],
    });
    expect(p.grupos).toHaveLength(2);
    expect(p.grupos[0]).toMatchObject({ minimo: 1, maximo: 1, obligatorio: true });
    expect(p.grupos[0].opciones.map((o) => o.id)).toEqual(['o1']);
    expect(p.grupos[1]).toMatchObject({ minimo: 0, maximo: 3, obligatorio: false });
  });

  it('toma opciones del grupo general cuando el del producto no las trae', () => {
    const p = aProductoCarta(
      { grupos: [{ id: 'g1', nombre: 'Leche' }] },
      [{ id: 'g1', nombre: 'Leche', opciones: [{ id: 'o1', nombre: 'Entera', precioExtra: 1 }] }],
    );
    expect(p.grupos[0].opciones[0].precioExtra).toBe(1);
  });

  it('inactivo y sin tamaños', () => {
    const d = { nombre: 'Torta', precio: 5, oculto: true, disponible: false };
    expect(aProductoCarta(d).disponible).toBe(false);
    expect(aProductoCarta(d).tamanos).toEqual([]);
    const av = avisosProducto(d).join(' ');
    expect(av).toMatch(/oculto/);
    expect(av).toMatch(/foto/);
    expect(av).toMatch(/descripción/);
    expect(av).toMatch(/tamaños/);
  });
});
