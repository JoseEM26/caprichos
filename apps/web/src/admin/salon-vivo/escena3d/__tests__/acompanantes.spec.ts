import { describe, expect, it } from 'vitest';
import { azarDe, cantidadClientes, configAleatoria, semilla } from '../acompanantes';

const REG = {
  cabello: [{ id: 'calvo', colores: ['principal'] }, { id: 'bob', colores: ['principal'] }, { id: 'largo', colores: [] }],
  arriba: [{ id: 'ninguno', colores: [] }, { id: 'polo', colores: ['principal', 'acento'] }, { id: 'camisa', colores: ['principal'] }],
  abajo: [{ id: 'jean', colores: ['principal'] }],
  calzado: [{ id: 'zapatilla', colores: [] }],
} as never;

describe('acompañantes por bebidas', () => {
  it('3 bebidas = cliente + 2', () => {
    expect(cantidadClientes({ bebidas: 3, sillas: 6 })).toBe(3);
  });
  it('tope por sillas de la mesa y por el cupo de la escena', () => {
    expect(cantidadClientes({ bebidas: 9, sillas: 4 })).toBe(4);
    expect(cantidadClientes({ bebidas: 5, sillas: 6, cupo: 2 })).toBe(2);
    expect(cantidadClientes({ bebidas: 5, sillas: 6, cupo: 0 })).toBe(1);
  });
  it('si se sabe cuántas personas son (reserva), manda ese número', () => {
    expect(cantidadClientes({ personas: 2, bebidas: 5, sillas: 6 })).toBe(2);
  });
  it('sin bebidas ni personas: dos; nunca menos de uno', () => {
    expect(cantidadClientes({ sillas: 6 })).toBe(2);
    expect(cantidadClientes({ bebidas: 0, sillas: 1 })).toBe(1);
    expect(cantidadClientes({ bebidas: 3, sillas: 0 })).toBe(1);
  });
});

describe('avatar aleatorio estable', () => {
  it('la misma semilla (id del pedido + puesto) da siempre el mismo avatar', () => {
    const a = configAleatoria({ REG }, semilla('1234:1'));
    expect(configAleatoria({ REG }, semilla('1234:1'))).toEqual(a);
    expect(azarDe(7)()).toBe(azarDe(7)());
  });
  it('semillas distintas dan avatares distintos (en general)', () => {
    const vistos = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(configAleatoria({ REG }, semilla(`p${i}:0`)))));
    expect(vistos.size).toBeGreaterThan(6);
  });
  it('es sencillo: sin gorro, extras ni mascota, sin calvo ni piezas vacías', () => {
    for (let i = 0; i < 30; i++) {
      const c = configAleatoria({ REG }, i) as Record<string, any>;
      expect(c.cabeza ?? c.cara ?? c.accesorio ?? c.mascota ?? c.disfraz).toBeUndefined();
      expect(c.cabello.id).not.toBe('calvo');
      expect(c.arriba.id).not.toBe('ninguno');
      expect(['mujer', 'hombre', 'neutro']).toContain(c.genero);
    }
  });
});
