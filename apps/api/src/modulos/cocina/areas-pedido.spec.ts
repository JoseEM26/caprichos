import { estadoAreasDePedido } from './areas-pedido';

const c = (id: number, estado: string, nombre = `A${id}`) => ({ area_id: BigInt(id), estado, area: { nombre } });
const l = (area: number, cantidad = 1, despachadas = 0) => ({ cantidad, despachadas, area_id: BigInt(area) });

describe('estadoAreasDePedido', () => {
  it('todas listas: completo', () => {
    const r = estadoAreasDePedido([c(1, 'DESPEJADA'), c(2, 'DESPEJADA')], [l(1), l(2)]);
    expect(r).toMatchObject({ areasListas: 2, areasTotal: 2, completo: true });
  });
  it('algunas listas: falta, no completo', () => {
    const r = estadoAreasDePedido([c(1, 'DESPEJADA'), c(2, 'EN_COCINA'), c(3, 'DESPEJADA')], [l(1), l(2), l(3)]);
    expect(r).toMatchObject({ areasListas: 2, areasTotal: 3, completo: false });
    expect(r.areas.map((a) => a.listo)).toEqual([true, false, true]);
  });
  it('ninguna lista', () => {
    const r = estadoAreasDePedido([c(1, 'EN_COCINA')], [l(1)]);
    expect(r).toMatchObject({ areasListas: 0, areasTotal: 1, completo: false });
  });
  it('despachada solo si todas sus líneas salieron', () => {
    const r = estadoAreasDePedido([c(1, 'DESPEJADA'), c(2, 'DESPEJADA')], [l(1, 2, 2), l(2, 2, 1)]);
    expect(r.areas.map((a) => a.despachada)).toEqual([true, false]);
  });
  it('sin comandas: no completo y sin áreas', () => {
    expect(estadoAreasDePedido([], [l(1)])).toEqual({ areas: [], areasListas: 0, areasTotal: 0, completo: false });
  });
  it('una sola área', () => {
    expect(estadoAreasDePedido([c(1, 'DESPEJADA')], [l(1)])).toMatchObject({ areasTotal: 1, completo: true });
  });
  it('las áreas sin líneas se omiten y la línea toma el área de su categoría', () => {
    const r = estadoAreasDePedido(
      [c(1, 'DESPEJADA'), c(2, 'EN_COCINA')],
      [{ cantidad: 1, producto: { categoria: { area_id: 1n } } }],
    );
    expect(r.areas.map((a) => a.areaId)).toEqual(['1']);
    expect(r.completo).toBe(true);
  });
});
