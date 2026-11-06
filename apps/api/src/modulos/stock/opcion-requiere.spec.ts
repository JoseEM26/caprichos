import { requisitosFaltantes, SaldosRequisitos } from './opcion-requiere';

/** Saldos mínimos para las reglas puras: un producto por sabor con saldo, y una empanada sin control de stock. */
const saldos: SaldosRequisitos = {
  productos: new Map([
    ['20', { oculto: false, agotadoHasta: null, controlaStock: true, saldo: 0, sabores: [
      { id: '501', productoId: '20', activo: true, agotadoHasta: null, saldo: 3 },
      { id: '502', productoId: '20', activo: true, agotadoHasta: null, saldo: 1 },
    ] }],
    ['30', { oculto: false, agotadoHasta: null, controlaStock: false, saldo: 0, sabores: [] }],
  ]),
  sabores: new Map([
    ['501', { id: '501', productoId: '20', activo: true, agotadoHasta: null, saldo: 3 }],
    ['502', { id: '502', productoId: '20', activo: true, agotadoHasta: null, saldo: 1 }],
  ]),
};

describe('requisitosFaltantes', () => {
  it('2 Donas con donas en 0 no alcanza; con 3 donas repartidas sí', () => {
    const vacias: SaldosRequisitos = { productos: new Map([['20', { oculto: false, agotadoHasta: null, controlaStock: true, saldo: 0, sabores: [] }]]), sabores: new Map() };
    expect(requisitosFaltantes([{ productoId: '20', saborId: null, cantidad: 2 }], vacias)).toHaveLength(1);
    expect(requisitosFaltantes([{ productoId: '20', saborId: null, cantidad: 2 }], saldos)).toEqual([]);
  });

  it('dos requisitos del mismo sabor con saldo 1 no caben', () => {
    const faltan = requisitosFaltantes([
      { productoId: '20', saborId: '502', cantidad: 1 },
      { productoId: '20', saborId: '502', cantidad: 1 },
    ], saldos);
    expect(faltan).toEqual([{ productoId: '20', saborId: '502', cantidad: 2 }]);
  });

  it('un sabor de un producto que NO controla stock (empanada) no bloquea aunque no tenga filas de saldo', () => {
    expect(requisitosFaltantes([{ productoId: '30', saborId: '900', cantidad: 1 }], saldos)).toEqual([]);
  });
});
