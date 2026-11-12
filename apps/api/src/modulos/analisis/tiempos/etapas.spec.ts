import { calcularEtapas, etapaActual, type PedidoParaTiempos } from './etapas';

const base = new Date('2026-11-10T15:00:00Z').getTime();
const t = (min: number) => new Date(base + min * 60000);

function pedido(extra: Partial<PedidoParaTiempos> = {}): PedidoParaTiempos {
  return {
    id: 1n,
    codigo: 'CP-1',
    estado: 'ENTREGADO',
    modalidad: 'MESA',
    pago_estado: 'PAGADO',
    creado_en: t(0),
    pago_coordinado_en: null,
    pasa_cocina_en: t(2),
    listo_en: t(20),
    entregado_mesa_en: t(24),
    entregado_en: t(24),
    anulado_en: null,
    tomado_en: null,
    salio_en: null,
    despachado_en: null,
    llego_en: null,
    comandas: [
      { area_id: 1n, estado: 'DESPEJADA', despejada_en: t(10), area: { nombre: 'Cocina' } },
      { area_id: 2n, estado: 'DESPEJADA', despejada_en: t(16), area: { nombre: 'Barra' } },
    ],
    lineas: [{ despachado_en: t(18) }, { despachado_en: t(19) }],
    cobros: [{ en: t(30), caja: { cerrada_en: t(630) } }],
    ...extra,
  };
}

describe('calcularEtapas', () => {
  it('mesa completa: cada etapa sale de su marca', () => {
    const { minutos, areas } = calcularEtapas(pedido());
    expect(minutos.aprobacion).toBeNull(); // sin pago coordinado no hay etapa de aprobación
    expect(minutos.a_cocina).toBe(2);
    expect(minutos.cocina).toBe(14); // hasta la última área (Barra a los 16)
    expect(minutos.espera_despacho).toBe(2); // 16 -> primera entrega a los 18
    expect(minutos.armado).toBe(2); // 18 -> Listo a los 20
    expect(minutos.entrega_mesa).toBe(4);
    expect(minutos.cobro).toBe(6);
    expect(minutos.cierre).toBe(600);
    expect(minutos.recojo).toBeUndefined();
    expect(areas).toEqual([
      { nombre: 'Barra', minutos: 14 },
      { nombre: 'Cocina', minutos: 8 },
    ]);
  });

  it('pago coordinado aprobado antes de cocina: mide aprobación y envía a cocina desde ahí', () => {
    const { minutos } = calcularEtapas(pedido({ pago_coordinado_en: t(1) }));
    expect(minutos.aprobacion).toBe(1);
    expect(minutos.a_cocina).toBe(1);
  });

  it('pago coordinado aprobado DESPUÉS de cocina no cuenta como espera de aprobación', () => {
    const { minutos } = calcularEtapas(pedido({ pago_coordinado_en: t(40) }));
    expect(minutos.aprobacion).toBeNull();
    expect(minutos.a_cocina).toBe(2);
  });

  it('un área sin terminar deja cocina en sin dato pero conserva las áreas que sí terminaron', () => {
    const { minutos, areas } = calcularEtapas(
      pedido({
        comandas: [
          { area_id: 1n, estado: 'DESPEJADA', despejada_en: t(10), area: { nombre: 'Cocina' } },
          { area_id: 2n, estado: 'EN_COCINA', despejada_en: null, area: { nombre: 'Barra' } },
        ],
      }),
    );
    expect(minutos.cocina).toBeNull();
    expect(minutos.espera_despacho).toBeUndefined();
    expect(areas.find((a) => a.nombre === 'Cocina')!.minutos).toBe(8);
    expect(areas.find((a) => a.nombre === 'Barra')!.minutos).toBeNull();
  });

  it('Listo puesto a mano (sin hora por línea): espera de despacho toma hasta Listo y armado queda sin dato', () => {
    const { minutos } = calcularEtapas(pedido({ lineas: [{ despachado_en: null }] }));
    expect(minutos.espera_despacho).toBe(4);
    expect(minutos.armado).toBeNull();
  });

  it('despacho antes de despejar el área dura 0 (tramos que se traslapan)', () => {
    const { minutos } = calcularEtapas(pedido({ lineas: [{ despachado_en: t(12) }] }));
    expect(minutos.espera_despacho).toBe(0);
  });

  it('cobrado antes de entregar: el cobro dura 0, no negativo', () => {
    const { minutos } = calcularEtapas(pedido({ cobros: [{ en: t(5), caja: null }] }));
    expect(minutos.cobro).toBe(0);
    expect(minutos.cierre).toBeNull(); // caja sin cerrar
  });

  it('sin cobro: cobro y cierre sin dato', () => {
    const { minutos } = calcularEtapas(pedido({ cobros: [] }));
    expect(minutos.cobro).toBeNull();
    expect(minutos.cierre).toBeNull();
  });

  it('para llevar: Listo a recogido', () => {
    const { minutos } = calcularEtapas(pedido({ modalidad: 'RECOGER', entregado_mesa_en: null, entregado_en: t(27) }));
    expect(minutos.recojo).toBe(7);
    expect(minutos.entrega_mesa).toBeUndefined();
  });

  it('delivery: espera repartidor, asignado a salida, en camino y entrega', () => {
    const { minutos } = calcularEtapas(
      pedido({ modalidad: 'DELIVERY', entregado_mesa_en: null, tomado_en: t(23), salio_en: t(28), llego_en: t(50), entregado_en: t(53) }),
    );
    expect(minutos.reparto_espera).toBe(3);
    expect(minutos.reparto_salida).toBe(5);
    expect(minutos.reparto_ruta).toBe(22);
    expect(minutos.reparto_entrega).toBe(3);
  });

  it('delivery marcado En camino a mano (sin salio_en) usa despachado_en como salida', () => {
    const { minutos } = calcularEtapas(
      pedido({ modalidad: 'DELIVERY', entregado_mesa_en: null, tomado_en: null, salio_en: null, despachado_en: t(28), llego_en: t(50), entregado_en: t(53) }),
    );
    expect(minutos.reparto_ruta).toBe(22);
    expect(minutos.reparto_salida).toBeNull();
    expect(minutos.reparto_espera).toBeNull();
  });

  it('marcas en orden imposible dan sin dato, no minutos negativos', () => {
    const { minutos } = calcularEtapas(pedido({ pasa_cocina_en: t(-5) }));
    expect(minutos.a_cocina).toBeNull();
  });

  it('anulado: ninguna etapa', () => {
    const r = calcularEtapas(pedido({ estado: 'ANULADO', anulado_en: t(3) }));
    expect(r.minutos).toEqual({});
    expect(r.areas).toEqual([]);
  });

  it('pedido sin cocina (sin comandas): cocina y despacho sin dato', () => {
    const { minutos, areas } = calcularEtapas(pedido({ comandas: [] }));
    expect(minutos.cocina).toBeNull();
    expect(minutos.espera_despacho).toBeUndefined();
    expect(areas).toEqual([]);
  });
});

describe('etapaActual', () => {
  it('COLA sin aprobar: aprobación desde que entró', () => {
    const e = etapaActual(pedido({ estado: 'COLA', pago_estado: 'PENDIENTE', pasa_cocina_en: null }));
    expect(e).toMatchObject({ codigo: 'aprobacion', desde: t(0) });
  });

  it('COLA con pago aprobado: a cocina desde la aprobación', () => {
    const e = etapaActual(pedido({ estado: 'COLA', pasa_cocina_en: null, pago_coordinado_en: t(3) }));
    expect(e).toMatchObject({ codigo: 'a_cocina', desde: t(3) });
  });

  it('PREPARANDO con un área pendiente: cocina y nombra el área', () => {
    const e = etapaActual(
      pedido({
        estado: 'PREPARANDO',
        comandas: [
          { area_id: 1n, estado: 'DESPEJADA', despejada_en: t(10), area: { nombre: 'Cocina' } },
          { area_id: 2n, estado: 'EN_COCINA', despejada_en: null, area: { nombre: 'Barra' } },
        ],
      }),
    );
    expect(e).toMatchObject({ codigo: 'cocina', areasPendientes: ['Barra'], desde: t(2) });
  });

  it('PREPARANDO con todo listo: espera de despacho, o armado si ya entregó algo', () => {
    expect(etapaActual(pedido({ estado: 'PREPARANDO', lineas: [{ despachado_en: null }] }))).toMatchObject({ codigo: 'espera_despacho', desde: t(16) });
    expect(etapaActual(pedido({ estado: 'PREPARANDO' }))).toMatchObject({ codigo: 'armado', desde: t(18) });
  });

  it('LISTO por modalidad', () => {
    expect(etapaActual(pedido({ estado: 'LISTO', entregado_mesa_en: null }))?.codigo).toBe('entrega_mesa');
    expect(etapaActual(pedido({ estado: 'LISTO', modalidad: 'RECOGER' }))?.codigo).toBe('recojo');
    expect(etapaActual(pedido({ estado: 'LISTO', modalidad: 'DELIVERY' }))?.codigo).toBe('reparto_espera');
    expect(etapaActual(pedido({ estado: 'LISTO', modalidad: 'DELIVERY', tomado_en: t(21) }))).toMatchObject({ codigo: 'reparto_salida', desde: t(21) });
  });

  it('EN_CAMINO: en ruta, y entrega si ya llegó', () => {
    expect(etapaActual(pedido({ estado: 'EN_CAMINO', modalidad: 'DELIVERY', salio_en: t(25) }))).toMatchObject({ codigo: 'reparto_ruta', desde: t(25) });
    expect(etapaActual(pedido({ estado: 'EN_CAMINO', modalidad: 'DELIVERY', salio_en: t(25), llego_en: t(40) }))?.codigo).toBe('reparto_entrega');
  });

  it('ENTREGADO sin pagar ni cobro: cobro; pagado: nada; anulado: nada', () => {
    expect(etapaActual(pedido({ pago_estado: 'PENDIENTE', cobros: [] }))).toMatchObject({ codigo: 'cobro', desde: t(24) });
    expect(etapaActual(pedido())).toBeNull();
    expect(etapaActual(pedido({ estado: 'ANULADO' }))).toBeNull();
  });
});
