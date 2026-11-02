import { progresoDelPedido } from './progreso-pedido';

const AHORA = new Date('2026-11-01T18:00:00Z');
const hace = (min: number) => new Date(AHORA.getTime() - min * 60000);

const pedido = (lineas: any[], over: Record<string, unknown> = {}) => ({
  estado: 'PREPARANDO',
  modalidad: 'MESA',
  creado_en: hace(5),
  pasa_cocina_en: hace(2),
  comandas: [{ area_id: 5n, estado: 'EN_COCINA', area: { nombre: 'Salados' } }],
  lineas,
  ...over,
});

describe('progresoDelPedido: Listo en ~N min', () => {
  const preparacion = { porProducto: new Map([['1', 12]]), defectoMin: 10 };

  it('estima el mayor de (promedio del producto - minutos ya en cocina) de lo que falta', () => {
    const res = progresoDelPedido(
      pedido([{ id: 10n, nombre: 'Lomo', cantidad: 1, listas: 0, producto_id: 1n, area_id: 5n }]),
      { ahora: AHORA, preparacion },
    );
    expect(res.estimadoMin).toBe(10); // 12 de promedio - 2 transcurridos
  });

  it('usa el defecto si el producto no tiene datos', () => {
    const res = progresoDelPedido(
      pedido([{ id: 10n, nombre: 'Tamal', cantidad: 1, listas: 0, producto_id: 9n, area_id: 5n }]),
      { ahora: AHORA, preparacion },
    );
    expect(res.estimadoMin).toBe(8); // 10 de defecto - 2
  });

  it('nunca baja de 1 minuto', () => {
    const res = progresoDelPedido(
      pedido([{ id: 10n, nombre: 'Lomo', cantidad: 1, listas: 0, producto_id: 1n, area_id: 5n }], {
        pasa_cocina_en: hace(30),
      }),
      { ahora: AHORA, preparacion },
    );
    expect(res.estimadoMin).toBe(1);
  });

  it('sin nada pendiente no hay estimado', () => {
    const res = progresoDelPedido(
      pedido([{ id: 10n, nombre: 'Lomo', cantidad: 1, listas: 1, producto_id: 1n, area_id: 5n }]),
      { ahora: AHORA, preparacion },
    );
    expect(res.estimadoMin).toBeUndefined();
  });

  it('sin tiempos de preparación (vista del cliente) no muestra estimado', () => {
    const res = progresoDelPedido(
      pedido([{ id: 10n, nombre: 'Lomo', cantidad: 1, listas: 0, producto_id: 1n, area_id: 5n }]),
    );
    expect(res).not.toHaveProperty('estimadoMin');
  });
});
