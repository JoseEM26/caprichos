import { TiemposService, MAX_PEDIDOS_TIEMPOS } from './tiempos.service';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 en Lima
const t = (min: number) => new Date(AHORA.getTime() + min * 60000);

function fila(id: number, extra: Record<string, unknown> = {}) {
  return {
    id: BigInt(id),
    codigo: `CP-${id}`,
    canal: 'CAJA',
    estado: 'ENTREGADO',
    modalidad: 'RECOGER',
    pago_estado: 'PAGADO',
    creado_en: t(-120),
    pago_coordinado_en: null,
    pasa_cocina_en: t(-118),
    listo_en: t(-100),
    entregado_mesa_en: null,
    entregado_en: t(-90),
    anulado_en: null,
    tomado_en: null,
    salio_en: null,
    despachado_en: null,
    llego_en: null,
    cliente_nombre: null,
    mesa_nombre: null,
    comandas: [{ area_id: 1n, estado: 'DESPEJADA', despejada_en: t(-105), area: { nombre: 'Cocina' } }],
    lineas: [{ despachado_en: t(-102) }],
    cobros: [{ en: t(-80), caja: { cerrada_en: t(-20) } }],
    ...extra,
  };
}

function servicio(filas: any[], parametros: Array<{ clave: string; valor: unknown }> = []) {
  const prisma: any = {
    pedido: { findMany: jest.fn(async () => filas) },
    parametro: { findMany: jest.fn(async () => parametros) },
  };
  return { s: new TiemposService(prisma), prisma };
}

describe('TiemposService.resumen', () => {
  it('promedia por etapa, marca la más lenta y deja sin dato las que no aplican', async () => {
    const { s } = servicio([fila(1), fila(2, { entregado_en: t(-80) })]);
    const r = await s.resumen({ desde: '2026-11-11', hasta: '2026-11-11' }, AHORA);
    expect(r.pedidos).toMatchObject({ entran: 2, considerados: 2 });
    const cocina = r.etapas.find((e) => e.codigo === 'cocina')!;
    expect(cocina).toMatchObject({ n: 2, promedio: 13, mediana: 13, meta: 15, semaforo: 'verde' });
    const recojo = r.etapas.find((e) => e.codigo === 'recojo')!;
    expect(recojo).toMatchObject({ n: 2, promedio: 15, mediana: 15, semaforo: 'ambar' }); // meta 10, 15 <= 1.5x
    expect(r.etapas.find((e) => e.codigo === 'reparto_ruta')).toMatchObject({ sinDato: true, n: 0, promedio: null, semaforo: 'sin_dato' });
    // El cierre (60 min de la caja cerrada) no compite; la más lenta es el recojo
    expect(r.etapaMasLenta).toBe('recojo');
    expect(r.areas).toEqual([expect.objectContaining({ nombre: 'Cocina', n: 2, promedio: 13 })]);
  });

  it('los anulados se muestran aparte y no entran al promedio', async () => {
    const { s } = servicio([fila(1), fila(2, { estado: 'ANULADO', anulado_en: t(-110), entregado_en: null })]);
    const r = await s.resumen({ desde: '2026-11-11' }, AHORA);
    expect(r.pedidos).toMatchObject({ entran: 2, considerados: 1 });
    expect(r.anulados).toEqual({ n: 1, minutosPromedio: 10, minutosMediana: 10 });
    expect(r.etapas.find((e) => e.codigo === 'cocina')!.n).toBe(1);
  });

  it('las metas guardadas en Configuración mandan sobre las de defecto', async () => {
    const { s } = servicio([fila(1)], [{ clave: 'meta_tiempo_cocina_min', valor: 5 }]);
    const r = await s.resumen({}, AHORA);
    expect(r.etapas.find((e) => e.codigo === 'cocina')).toMatchObject({ meta: 5, semaforo: 'rojo' });
  });

  it('sin pedidos: todo sin dato, sin etapa más lenta', async () => {
    const { s } = servicio([]);
    const r = await s.resumen({}, AHORA);
    expect(r.etapaMasLenta).toBeNull();
    expect(r.etapas.every((e) => e.sinDato)).toBe(true);
    expect(r.areas).toEqual([]);
  });

  it('el filtro de turno usa la hora de Lima del pedido', async () => {
    const { s } = servicio([fila(1, { creado_en: new Date('2026-11-11T14:00:00Z') }), fila(2, { creado_en: new Date('2026-11-11T23:30:00Z') })]);
    const r = await s.resumen({ desde: '2026-11-11', turno: 'noche' }, AHORA);
    expect(r.pedidos.entran).toBe(1);
  });

  it('pasa modalidad, canal y el rango en horario de Lima a la consulta, con tope', async () => {
    const { s, prisma } = servicio([]);
    await s.resumen({ desde: '2026-11-10', hasta: '2026-11-11', modalidad: 'delivery', canal: 'carta' }, AHORA);
    const args = prisma.pedido.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ modalidad: 'DELIVERY', canal: 'CARTA' });
    expect(args.where.creado_en.gte.toISOString()).toBe('2026-11-10T05:00:00.000Z');
    expect(args.where.creado_en.lt.toISOString()).toBe('2026-11-12T05:00:00.000Z');
    expect(args.take).toBe(MAX_PEDIDOS_TIEMPOS + 1);
  });

  it('avisa si se pasó del tope de pedidos', async () => {
    const { s } = servicio(Array.from({ length: MAX_PEDIDOS_TIEMPOS + 1 }, (_, i) => fila(i + 1)));
    const r = await s.resumen({}, AHORA);
    expect(r.truncado).toBe(true);
    expect(r.pedidos.entran).toBe(MAX_PEDIDOS_TIEMPOS);
  });

  it('rechaza un rango de más de 92 días sin tocar la base', async () => {
    const { s, prisma } = servicio([]);
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO', mensaje: expect.stringContaining('92') } });
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });
});

describe('TiemposService.atascados', () => {
  it('lista solo los que pasan su meta, del más pasado al menos, con su enlace', async () => {
    const { s } = servicio([
      // en cocina hace 40 min (meta 15): 2.7 veces
      fila(1, { estado: 'PREPARANDO', pasa_cocina_en: t(-40), listo_en: null, entregado_en: null, comandas: [{ area_id: 1n, estado: 'EN_COCINA', despejada_en: null, area: { nombre: 'Barra' } }], cobros: [] }),
      // en cocina hace 5 min: normal
      fila(2, { estado: 'PREPARANDO', pasa_cocina_en: t(-5), listo_en: null, entregado_en: null, comandas: [{ area_id: 1n, estado: 'EN_COCINA', despejada_en: null, area: { nombre: 'Barra' } }], cobros: [] }),
      // sin aprobar hace 30 min (meta 5): 6 veces
      fila(3, { estado: 'COLA', pago_estado: 'PENDIENTE', creado_en: t(-30), pasa_cocina_en: null, listo_en: null, entregado_en: null, comandas: [], lineas: [], cobros: [] }),
    ]);
    const r = await s.atascados(AHORA);
    expect(r.total).toBe(2);
    expect(r.items.map((i) => i.codigo)).toEqual(['CP-3', 'CP-1']);
    expect(r.items[0]).toMatchObject({ etapa: 'aprobacion', minutos: 30, meta: 5, semaforo: 'rojo', enlace: '/admin/caja?pedido=3' });
    expect(r.items[1]).toMatchObject({ etapa: 'cocina', areasPendientes: ['Barra'], enlace: '/admin/cocina' });
  });

  it('sin pedidos en curso devuelve lista vacía', async () => {
    const { s } = servicio([]);
    expect(await s.atascados(AHORA)).toMatchObject({ total: 0, items: [] });
  });
});
