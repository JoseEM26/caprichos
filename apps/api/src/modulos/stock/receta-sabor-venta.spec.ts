import { insumosDeVentaLinea, recetasDelSabor } from './receta.util';

// Receta general (sin sabor) de 10 g del insumo 1 y receta propia del sabor 7 con 5 g del insumo 2.
const general = { id: 'g', producto_id: 10n, tamano_valor_id: null, sabor_id: null, lineas: [{ insumo_id: 1n, cantidad: 10 }] };
const delSabor7 = { id: 's7', producto_id: 10n, tamano_valor_id: null, sabor_id: 7n, lineas: [{ insumo_id: 2n, cantidad: 5 }] };
const recetas = [general, delSabor7];
const enMapa = (xs: Array<{ insumoId: string; cantidad: number }>) => Object.fromEntries(xs.map((x) => [x.insumoId, x.cantidad]));

describe('recetasDelSabor', () => {
  it('sin sabor da la receta general; con sabor, la del sabor reemplaza la general del mismo tamaño', () => {
    expect(recetasDelSabor(recetas, null).map((r) => r.id)).toEqual(['g']);
    expect(recetasDelSabor(recetas, 7n).map((r) => r.id)).toEqual(['s7']);
    // Un sabor sin receta propia cae en la general (respaldo)
    expect(recetasDelSabor(recetas, 8n).map((r) => r.id)).toEqual(['g']);
  });
});

describe('insumosDeVentaLinea (venta con sabores)', () => {
  it('sin sabores usa la receta general', () => {
    expect(enMapa(insumosDeVentaLinea(recetas, [], null, [], 2))).toEqual({ '1': 20 });
  });

  it('el sabor con receta propia usa solo su receta: la general no se descuenta encima (sin doble conteo)', () => {
    const r = insumosDeVentaLinea(recetas, [], null, [], 1, [{ saborId: 7n, peso: 2 }]);
    expect(enMapa(r)).toEqual({ '2': 5 });
  });

  it('un sabor sin receta propia descuenta la general (respaldo)', () => {
    expect(enMapa(insumosDeVentaLinea(recetas, [], null, [], 1, [{ saborId: 8n, peso: 1 }]))).toEqual({ '1': 10 });
  });

  it('reparte la cantidad por el peso de cada sabor', () => {
    // 4 unidades: 1/4 al sabor 7 (5 g del insumo 2) y 3/4 al sabor 8 (general, 10 g del insumo 1)
    const r = insumosDeVentaLinea(recetas, [], null, [], 4, [
      { saborId: 7n, peso: 1 },
      { saborId: 8n, peso: 3 },
    ]);
    expect(enMapa(r)).toEqual({ '2': 5, '1': 30 });
  });

  it('sabores con peso 0 o nulo se ignoran y vuelve a la general', () => {
    expect(enMapa(insumosDeVentaLinea(recetas, [], null, [], 1, [{ saborId: 7n, peso: 0 }]))).toEqual({ '1': 10 });
  });
});
