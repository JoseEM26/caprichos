import { calcularDescuentoPersonal } from './descuento-personal';

describe('calcularDescuentoPersonal: 25 % sin combos ni promociones', () => {
  it('descuenta solo lo elegible', () => {
    const lineas = [
      { productoId: 1, nombre: 'Café americano', subtotal: 20 },
      { productoId: 2, nombre: 'Combo desayuno', subtotal: 30 },
      { productoId: 3, nombre: 'Promoción 2x1 waffle', subtotal: 24 },
      { productoId: 4, nombre: 'Docena de galletas', subtotal: 40 },
      { productoId: 5, nombre: 'Torta', subtotal: 10, enPromocion: true },
    ];
    expect(calcularDescuentoPersonal(lineas, [], 25)).toBe(5);
  });

  it('un pedido solo de combos no tiene descuento', () => {
    expect(calcularDescuentoPersonal([{ productoId: 1, nombre: 'Combo dúo', subtotal: 50 }], [], 25)).toBe(0);
  });

  it('redondea a céntimos', () => {
    expect(calcularDescuentoPersonal([{ productoId: 1, nombre: 'Café', subtotal: 10.99 }], [], 25)).toBe(2.75);
  });
});
