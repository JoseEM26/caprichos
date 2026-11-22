import { describe, expect, it } from 'vitest';
import { estaListo, frasePaseo, planEntrega, productosBandeja } from '../entrega';

const ped = (extra = {}) => ({ id: '10', modalidad: 'MESA', estado: 'LISTO', areas: [{ estado: 'LISTA' }], ...extra });

describe('¿está listo de verdad?', () => {
  it('LISTO, o todas las áreas terminadas; no si falta alguna', () => {
    expect(estaListo({ estado: 'LISTO', areas: [] })).toBe(true);
    expect(estaListo({ estado: 'PREPARANDO', areas: [{ estado: 'LISTA' }, { estado: 'LISTA' }] })).toBe(true);
    expect(estaListo({ estado: 'PREPARANDO', areas: [{ estado: 'LISTA' }, { estado: 'PENDIENTE' }] })).toBe(false);
    expect(estaListo({ estado: 'COLA', areas: [] })).toBe(false);
  });
});

describe('secuencia de entrega', () => {
  it('mesa: cocina, bandeja, mesa, entregar y agradecer; no se repite', () => {
    const hechas = new Set<string>();
    expect(planEntrega(ped(), hechas)).toEqual(['ir_cocina', 'tomar_bandeja', 'ir_mesa', 'entregar', 'agradecer']);
    expect(planEntrega(ped(), hechas)).toEqual([]);
    expect(planEntrega(ped({ id: '11' }), hechas)).toHaveLength(5);
  });
  it('delivery: cocina, caja, entrada, repartidor, él se va y ella vuelve; una sola vez', () => {
    const hechas = new Set<string>();
    const d = ped({ id: '20', modalidad: 'DELIVERY' });
    expect(planEntrega(d, hechas)).toEqual(['ir_cocina', 'tomar_caja', 'ir_entrada', 'entregar_repartidor', 'repartidor_se_va', 'volver']);
    expect(planEntrega(d, hechas)).toEqual([]);
  });
  it('para llevar: bolsa al mostrador', () => {
    expect(planEntrega(ped({ id: '30', modalidad: 'LLEVAR' }), new Set())).toEqual(['ir_cocina', 'tomar_bolsa', 'ir_mostrador', 'agradecer']);
  });
  it('un pedido que no está listo no arma nada ni se anota', () => {
    const hechas = new Set<string>();
    expect(planEntrega(ped({ estado: 'PREPARANDO', areas: [{ estado: 'PENDIENTE' }] }), hechas)).toEqual([]);
    expect(hechas.size).toBe(0);
  });
});

describe('qué lleva la bandeja', () => {
  it('al menos un vaso por bebida y un plato por el resto', () => {
    expect(productosBandeja(3, 4)).toEqual({ vasos: 3, platos: 1 });
    expect(productosBandeja(2, 2)).toEqual({ vasos: 2, platos: 0 });
    expect(productosBandeja(0, 3)).toEqual({ vasos: 0, platos: 3 });
  });
  it('tope de 6 y nunca vacía', () => {
    const r = productosBandeja(9, 20);
    expect(r.vasos + r.platos).toBe(6);
    expect(productosBandeja(0, 0)).toEqual({ vasos: 0, platos: 1 });
    expect(productosBandeja(undefined, undefined).platos).toBe(1);
  });
});

describe('qué dice Capri al pasar por una mesa', () => {
  it('con el pedido listo no dice que todavía no está', () => {
    expect(frasePaseo({ listo: true, enCocina: false, minutos: 30, comiendo: false })).toBe('listo');
    expect(frasePaseo({ listo: true, enCocina: true, minutos: 30, comiendo: false })).toBe('listo');
  });
  it('solo habla de la espera si de verdad sigue en cocina', () => {
    expect(frasePaseo({ listo: false, enCocina: true, minutos: 5, comiendo: false })).toBe('cocina');
    expect(frasePaseo({ listo: false, enCocina: true, minutos: 20, comiendo: false })).toBe('espera');
    expect(frasePaseo({ listo: false, enCocina: false, minutos: 20, comiendo: false })).toBeNull();
  });
  it('si ya comen, pregunta si todo está bien', () => {
    expect(frasePaseo({ listo: false, enCocina: false, minutos: 1, comiendo: true })).toBe('comiendo');
  });
});
