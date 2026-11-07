import { describe, it, expect } from 'vitest';
import { avisoSabor, avisoStock, umbralesAvisoStock, unidadNatural } from '../utilidades/avisos-stock.js';

const t = (quedan: number | null, nombre = 'Donas', u = umbralesAvisoStock()) => avisoStock({ controlaStock: true, quedan, nombre }, u);

describe('avisoStock con umbrales por defecto (5 y 3)', () => {
  it('textos por cantidad', () => {
    expect(t(1)?.texto).toBe('¡Última dona!');
    expect(t(2)?.texto).toBe('¡Últimas 2!');
    expect(t(3)?.texto).toBe('¡Quedan solo 3, ya se acaban!');
    expect(t(4)).toEqual({ tipo: 'quedan', texto: 'Quedan 4' });
    expect(t(5)?.texto).toBe('Quedan 5');
    expect(t(6)).toBeNull();
    expect(t(0)).toBeNull();
    expect(t(null)).toBeNull();
  });
  it('sin control no avisa', () => {
    expect(avisoStock({ controlaStock: false, quedan: 2 })).toBeNull();
  });
  it('1 con nombre no simple dice unidad; masculino y singular', () => {
    expect(t(1, 'Dona Glaseada')?.texto).toBe('¡Última unidad!');
    expect(t(1, 'Brownie')?.texto).toBe('¡Última unidad!');
    expect(t(1, 'Churros')?.texto).toBe('¡Último churro!');
    expect(t(1, 'Galleta')?.texto).toBe('¡Última galleta!');
    expect(avisoStock({ quedan: 1 })?.texto).toBe('¡Última unidad!');
    expect(unidadNatural('Pan')).toBeNull();
  });
  it('franja y quedan se distinguen por tipo', () => {
    expect(t(3)?.tipo).toBe('franja');
    expect(t(4)?.tipo).toBe('quedan');
  });
});

describe('umbrales configurables', () => {
  it('valores por defecto, inválidos y franja acotada por el aviso', () => {
    expect(umbralesAvisoStock()).toEqual({ quedan: 5, ultimas: 3 });
    expect(umbralesAvisoStock(8, 4)).toEqual({ quedan: 8, ultimas: 4 });
    expect(umbralesAvisoStock('8', '4')).toEqual({ quedan: 8, ultimas: 4 });
    expect(umbralesAvisoStock(25, -1)).toEqual({ quedan: 5, ultimas: 3 });
    expect(umbralesAvisoStock(2, 3)).toEqual({ quedan: 2, ultimas: 2 });
    expect(umbralesAvisoStock(2.5, 'x')).toEqual({ quedan: 5, ultimas: 3 });
  });
  it('se respetan al avisar', () => {
    const u = umbralesAvisoStock(8, 2);
    expect(t(3, 'Donas', u)?.texto).toBe('Quedan 3');
    expect(t(8, 'Donas', u)?.texto).toBe('Quedan 8');
    expect(t(9, 'Donas', u)).toBeNull();
    expect(t(2, 'Donas', u)?.texto).toBe('¡Últimas 2!');
  });
  it('0 desactiva', () => {
    const sinFranja = umbralesAvisoStock(5, 0);
    expect(t(1, 'Donas', sinFranja)?.texto).toBe('Queda 1');
    const nada = umbralesAvisoStock(0, 0);
    expect([0, 1, 2, 3, 4, 5].map((n) => t(n, 'Donas', nada))).toEqual([null, null, null, null, null, null]);
  });
});

describe('avisoSabor', () => {
  it('por sabor', () => {
    expect(avisoSabor('Fresa', 1)).toBe('Fresa: ¡última!');
    expect(avisoSabor('Oreo', 2)).toBe('Oreo: quedan 2');
    expect(avisoSabor('Oreo', 6)).toBeNull();
    expect(avisoSabor('Oreo', 0)).toBeNull();
    expect(avisoSabor('Oreo', null)).toBeNull();
    expect(avisoSabor('Oreo', 7, umbralesAvisoStock(7, 3))).toBe('Oreo: quedan 7');
    expect(avisoSabor('Oreo', 1, umbralesAvisoStock(0, 0))).toBeNull();
  });
});
