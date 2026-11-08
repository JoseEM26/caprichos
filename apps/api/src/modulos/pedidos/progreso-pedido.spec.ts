import { CONFIG_ETA_DEFECTO } from '../repartos/eta-entrega';
import { progresoDelPedido, EntradaProgreso } from './progreso-pedido';

const BEBIDAS = 1n;
const SALADOS = 2n;
const cfg = { ...CONFIG_ETA_DEFECTO, respaldoMin: 30 };
const ahora = new Date('2026-10-29T15:00:00Z');

/** Pedido con dos áreas de cocina (Bebidas y Salados), con sus líneas. */
function pedido(extra: Partial<EntradaProgreso> & { bebidas?: string; salados?: string }): EntradaProgreso {
  const { bebidas = 'EN_COCINA', salados = 'EN_COCINA', ...resto } = extra;
  return {
    estado: 'COLA',
    modalidad: 'RECOGER',
    comandas: [
      { area_id: BEBIDAS, estado: bebidas, area: { nombre: 'Bebidas' } },
      { area_id: SALADOS, estado: salados, area: { nombre: 'Salados' } },
    ],
    lineas: [
      { nombre: 'Frappé', cantidad: 2, area_id: BEBIDAS },
      { nombre: 'Limonada', cantidad: 1, area_id: BEBIDAS },
      // Línea sin área propia: se cuenta por la categoría del producto
      { nombre: 'Torta', cantidad: 1, area_id: null, producto: { categoria: { area_id: SALADOS } } },
    ],
    ...resto,
  };
}

describe('progresoDelPedido', () => {
  it('todas las áreas pendientes: en cocina, 0% y cada área pendiente con sus líneas', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'DELIVERY' }));

    expect(res).toMatchObject({
      etapa: 'EN_COCINA',
      etiqueta: 'En cocina',
      listasDe: 0,
      totalAreas: 2,
      porcentaje: 0,
      enCamino: false,
    });
    expect(res.areas).toEqual([
      {
        nombre: 'Bebidas',
        estado: 'PENDIENTE',
        lineas: 2,
        productos: [
          { nombre: 'Frappé', cantidad: 2, listas: 0, despachadas: 0 },
          { nombre: 'Limonada', cantidad: 1, listas: 0, despachadas: 0 },
        ],
      },
      {
        nombre: 'Salados',
        estado: 'PENDIENTE',
        lineas: 1,
        productos: [{ nombre: 'Torta', cantidad: 1, listas: 0, despachadas: 0 }],
      },
    ]);
  });

  it('pedido sin comandas todavía en COLA: recibido', () => {
    const res = progresoDelPedido(pedido({ comandas: [] }));
    expect(res).toMatchObject({ etapa: 'RECIBIDO', etiqueta: 'Pedido recibido', porcentaje: 0, totalAreas: 0 });
  });

  it('en preparación sin áreas listas: en cocina y las áreas preparando', () => {
    const res = progresoDelPedido(pedido({ estado: 'PREPARANDO' }));
    expect(res.etapa).toBe('EN_COCINA');
    expect(res.etiqueta).toBe('En cocina, en preparación');
    expect(res.areas.map((a) => a.estado)).toEqual(['PREPARANDO', 'PREPARANDO']);
  });

  it('mitad del pedido lista: parcial con el texto por área y el porcentaje', () => {
    const res = progresoDelPedido(pedido({ bebidas: 'DESPEJADA' }));

    expect(res).toMatchObject({
      etapa: 'PARCIAL',
      etiqueta: 'Cocina: listas Bebidas, faltan Salados',
      listasDe: 1,
      totalAreas: 2,
      porcentaje: 50,
    });
    expect(res.areas.map((a) => [a.nombre, a.estado])).toEqual([
      ['Bebidas', 'LISTA'],
      ['Salados', 'PENDIENTE'],
    ]);
  });

  it('mesa con todo listo: listo para entregar en mesa', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'MESA', estado: 'LISTO', bebidas: 'DESPEJADA', salados: 'DESPEJADA' }));
    expect(res).toMatchObject({ etapa: 'LISTO', etiqueta: 'Listo para entregar en mesa', porcentaje: 100, listasDe: 2 });
  });

  it('mesa ya entregada en mesa: entregado en mesa aunque el pedido siga en LISTO', () => {
    const res = progresoDelPedido(
      pedido({ modalidad: 'MESA', estado: 'LISTO', entregado_mesa_en: new Date(), bebidas: 'DESPEJADA', salados: 'DESPEJADA' }),
    );
    expect(res).toMatchObject({ etapa: 'ENTREGADO', etiqueta: 'Entregado en mesa', porcentaje: 100 });
  });

  it('para recoger listo: esperando al cliente', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'RECOGER', estado: 'LISTO', bebidas: 'DESPEJADA', salados: 'DESPEJADA' }));
    expect(res).toMatchObject({ etapa: 'ESPERANDO_CLIENTE', etiqueta: 'Listo, esperando al cliente', porcentaje: 100 });
  });

  it('delivery listo sin repartidor: esperando repartidor; con repartidor: esperando su salida', () => {
    const sin = progresoDelPedido(pedido({ modalidad: 'DELIVERY', estado: 'LISTO' }));
    expect(sin).toMatchObject({ etapa: 'LISTO', etiqueta: 'Listo, esperando repartidor' });

    const con = progresoDelPedido(pedido({ modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: 9n }));
    expect(con).toMatchObject({ etapa: 'LISTO', etiqueta: 'Listo, esperando salida del repartidor' });
  });

  it('todas las áreas despejadas aunque el pedido aún diga COLA: queda listo según la modalidad', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'RECOGER', bebidas: 'DESPEJADA', salados: 'DESPEJADA' }));
    expect(res).toMatchObject({ etapa: 'ESPERANDO_CLIENTE', porcentaje: 100 });
  });

  it('en camino con el tiempo que falta según lo prometido al salir', () => {
    const res = progresoDelPedido(
      pedido({
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: 9n,
        despachado_en: new Date(ahora.getTime() - 10 * 60000),
        eta_min: 25,
        eta_max: 30,
      }),
      { cfg, ahora },
    );

    expect(res).toMatchObject({
      etapa: 'EN_CAMINO',
      etiqueta: 'En camino, llega en unos 15 a 20 minutos',
      enCamino: true,
      etaMin: 15,
      etaMax: 20,
      porcentaje: 100,
    });
  });

  it('en camino sin reloj: solo la etiqueta, sin tiempo', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'DELIVERY', estado: 'EN_CAMINO' }));
    expect(res).toMatchObject({ etapa: 'EN_CAMINO', etiqueta: 'En camino', enCamino: true });
    expect(res.etaMin).toBeUndefined();
  });

  it('en camino con llego_en: «Tu repartidor llegó»; sin llego_en (pedido antiguo) sigue En camino', () => {
    const base = { modalidad: 'DELIVERY', estado: 'EN_CAMINO', repartidor_party_id: 9n };
    expect(progresoDelPedido(pedido({ ...base, llego_en: new Date() }))).toMatchObject({ etapa: 'LLEGO', etiqueta: 'Tu repartidor llegó', enCamino: true });
    expect(progresoDelPedido(pedido(base)).etapa).toBe('EN_CAMINO');
  });

  it('entregado: 100% y todas las áreas listas', () => {
    const res = progresoDelPedido(pedido({ modalidad: 'DELIVERY', estado: 'ENTREGADO' }));
    expect(res).toMatchObject({ etapa: 'ENTREGADO', etiqueta: 'Entregado', porcentaje: 100, enCamino: false });
    expect(res.areas.every((a) => a.estado === 'LISTA')).toBe(true);
  });

  it('anulado: sin áreas ni avance', () => {
    const res = progresoDelPedido(pedido({ estado: 'ANULADO' }));
    expect(res).toMatchObject({ etapa: 'ANULADO', etiqueta: 'Anulado', porcentaje: 0, areas: [], totalAreas: 0 });
  });

  it('no devuelve ningún dato de cocina más allá de áreas, estados y líneas', () => {
    const res = progresoDelPedido(pedido({ bebidas: 'DESPEJADA' }));
    expect(Object.keys(res).sort()).toEqual(
      ['areas', 'enCamino', 'etapa', 'etiqueta', 'listasDe', 'porcentaje', 'totalAreas'].sort(),
    );
    expect(Object.keys(res.areas[0]).sort()).toEqual(['estado', 'lineas', 'nombre', 'productos']);
    expect(Object.keys(res.areas[0].productos[0]).sort()).toEqual(
      ['cantidad', 'despachadas', 'listas', 'nombre'].sort(),
    );
  });
});
