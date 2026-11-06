jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { sincronizarRuta, sumarARuta } from './rutas-reparto';

const A = { partyId: 10n, rol: 'REPARTIDOR', debeCambiar: false } as any;
const B = { partyId: 20n, rol: 'REPARTIDOR', debeCambiar: false } as any;
const CAJA = { partyId: 1n, rol: 'CAJERO', debeCambiar: false } as any;

const ped = (id: bigint, o: any = {}) => ({
  id, codigo: `CP-${id}`, estado: 'LISTO', modalidad: 'DELIVERY', repartidor_party_id: null, ruta_reparto_id: null,
  orden_ruta: null, entrega_lat: -12.0 - Number(id) / 100, entrega_lng: -77.0, anulado_en: null, entregado_en: null,
  salio_en: null, motivo_falla: null, creado_en: new Date(), total: 10, pago_estado: 'PAGADO', pago_metodo: 'YAPE',
  cliente_nombre: `Cliente ${id}`, cliente_telefono: '999', entrega_direccion: 'Calle', zona_id: null, ...o,
});

/** Base en memoria: lo justo de prisma para probar la ruta como unidad. */
function montar(pedidos: any[]) {
  const rutas: any[] = [];
  const incidentes: any[] = [];
  const casa = (p: any, w: any): boolean =>
    Object.entries(w).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((x: any) => casa(p, x));
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(p[k]);
        if ('not' in v) return p[k] !== v.not && (v.not !== null || p[k] !== undefined);
        if ('gte' in v) return p[k] >= v.gte && p[k] <= v.lte;
      }
      return p[k] === v;
    });
  const db: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([]) },
    pedidoEstadoHistorial: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    incidenteEntrega: { count: jest.fn(async () => 0), create: jest.fn(async ({ data }: any) => { incidentes.push(data); return { id: 1n }; }) },
    pedido: {
      findMany: jest.fn(async ({ where }: any) =>
        pedidos.filter((p) => casa(p, where)).map((p) => ({
          ...p, zona: null, lineas: [],
          incidentes: incidentes.filter((i) => i.pedido_id === p.id).map((i) => ({ en: i.en })).slice(-1),
        }))),
      findUnique: jest.fn(async ({ where }: any) => {
        const p = pedidos.find((x) => x.id === where.id);
        return p ? { ...p, zona: null } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(pedidos.find((p) => p.id === where.id), data, { zona: null, lineas: [] })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const ok = pedidos.filter((p) => casa(p, where));
        ok.forEach((p) => Object.assign(p, data));
        return { count: ok.length };
      }),
      count: jest.fn(async ({ where }: any) => pedidos.filter((p) => casa(p, where)).length),
    },
    rutaReparto: {
      findFirst: jest.fn(async ({ where }: any) => [...rutas].reverse().find((r) => casa(r, where)) ?? null),
      create: jest.fn(async ({ data }: any) => { const r = { id: BigInt(rutas.length + 1), terminada_en: null, ...data }; rutas.push(r); return r; }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(rutas.find((r) => r.id === where.id), data)),
      delete: jest.fn(async ({ where }: any) => { rutas.splice(rutas.findIndex((r) => r.id === where.id), 1); }),
      count: jest.fn(async ({ where }: any) => rutas.filter((r) => casa(r, where)).length),
      findMany: jest.fn(async ({ where, skip = 0, take = 99 }: any) =>
        rutas.filter((r) => casa(r, where)).slice(skip, skip + take).map((r) => ({ ...r, repartidor: null }))),
    },
    $transaction: jest.fn((fn: any) => fn(db)),
    $queryRaw: jest.fn(async () => pedidos.map((p) => ({ ...p }))),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new RepartosService(db, auditoria, new RutaService());
  return { service, db, pedidos, rutas, incidentes };
}

describe('la ruta como unidad', () => {
  it('sumarARuta crea la ruta y una segunda toma se suma a la misma', async () => {
    const { db, pedidos, rutas } = montar([ped(1n, { repartidor_party_id: 10n }), ped(2n, { repartidor_party_id: 10n })]);
    await sumarARuta(db, 10n, [1n], 'TOMAR_RUTA', new Date());
    await sumarARuta(db, 10n, [2n], 'INDIVIDUAL', new Date());
    expect(rutas).toHaveLength(1);
    expect(rutas[0]).toMatchObject({ repartidor_party_id: 10n, estado: 'EN_CURSO', origen: 'TOMAR_RUTA' });
    expect(pedidos.map((p) => p.ruta_reparto_id)).toEqual([1n, 1n]);
  });

  it('tomar-ruta crea la ruta del repartidor y otro repartidor tiene la suya', async () => {
    const { service, rutas, pedidos } = montar([ped(1n), ped(2n), ped(3n)]);
    await service.tomarRuta({ ids: ['1', '2'] } as any, A);
    await service.tomarRuta({ ids: ['3'] } as any, B);
    expect(rutas.map((r) => [r.repartidor_party_id, r.origen])).toEqual([[10n, 'TOMAR_RUTA'], [20n, 'TOMAR_RUTA']]);
    expect(pedidos.map((p) => p.ruta_reparto_id)).toEqual([1n, 1n, 2n]);
  });

  it('se cierra sola al entregar el último; antes de eso sigue EN_CURSO y los entregados se quedan', async () => {
    const { service, rutas, pedidos } = montar([
      ped(1n, { repartidor_party_id: 10n, estado: 'EN_CAMINO', ruta_reparto_id: 1n }),
      ped(2n, { repartidor_party_id: 10n, estado: 'EN_CAMINO', ruta_reparto_id: 1n }),
    ]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    await service.entregar('1', A);
    expect(rutas[0].estado).toBe('EN_CURSO');
    expect(pedidos[0].ruta_reparto_id).toBe(1n); // el entregado conserva su ruta
    await service.entregar('2', A);
    expect(rutas[0]).toMatchObject({ estado: 'TERMINADA' });
    expect(rutas[0].terminada_en).toBeInstanceOf(Date);
  });

  it('una falla cuenta como final: la ruta cierra y el pedido queda NO_ENTREGADO en ella', async () => {
    const { service, rutas, pedidos } = montar([
      ped(1n, { repartidor_party_id: 10n, estado: 'EN_CAMINO', ruta_reparto_id: 1n }),
      ped(2n, { repartidor_party_id: 10n, estado: 'EN_CAMINO', ruta_reparto_id: 1n }),
    ]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    await service.entregar('1', A);
    await service.reportarFalla('2', { motivo: 'CLIENTE_AUSENTE', contactos: [] } as any, A);
    expect(rutas[0].estado).toBe('TERMINADA');
    expect(pedidos[1]).toMatchObject({ repartidor_party_id: null, ruta_reparto_id: 1n });
    const { rutas: lista } = await service.listarRutas({ desde: '2000-01-01', hasta: '2999-01-01' }, A);
    expect(lista[0]).toMatchObject({ totalPedidos: 2, entregados: 1, fallidos: 1 });
    expect(lista[0].pedidos.map((p) => p.estadoFinal)).toEqual(['ENTREGADO', 'NO_ENTREGADO']);
  });

  it('liberar antes de salir quita el pedido de la ruta; si queda vacía, la ruta se borra', async () => {
    const { service, rutas, pedidos } = montar([ped(1n, { repartidor_party_id: 10n, ruta_reparto_id: 1n })]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    await service.liberarPedido('1', { motivo: 'prueba' } as any, CAJA);
    expect(pedidos[0].ruta_reparto_id).toBeNull();
    expect(rutas).toHaveLength(0);
  });

  it('liberar un pedido de una ruta con otros pendientes deja la ruta EN_CURSO', async () => {
    const { service, rutas } = montar([
      ped(1n, { repartidor_party_id: 10n, ruta_reparto_id: 1n }),
      ped(2n, { repartidor_party_id: 10n, ruta_reparto_id: 1n }),
    ]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    await service.liberarPedido('1', { motivo: 'prueba' } as any, CAJA);
    expect(rutas).toHaveLength(1);
    expect(rutas[0].estado).toBe('EN_CURSO');
  });

  it('un pedido anulado en plena ruta cuenta como final', async () => {
    const { db, rutas } = montar([
      ped(1n, { repartidor_party_id: 10n, estado: 'ANULADO', anulado_en: new Date(), ruta_reparto_id: 1n }),
      ped(2n, { repartidor_party_id: 10n, estado: 'ENTREGADO', entregado_en: new Date(), ruta_reparto_id: 1n }),
    ]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    expect(await sincronizarRuta(db, 10n)).toBe(1n);
    expect(rutas[0].estado).toBe('TERMINADA');
  });

  it('mios devuelve los pedidos pendientes como siempre y rutaReparto con los terminados y su estado final', async () => {
    const hora = new Date('2026-10-31T15:00:00Z');
    const { service, rutas } = montar([
      ped(1n, { repartidor_party_id: 10n, estado: 'ENTREGADO', entregado_en: hora, ruta_reparto_id: 1n, orden_ruta: 1 }),
      ped(2n, { repartidor_party_id: null, motivo_falla: 'CLIENTE_AUSENTE', ruta_reparto_id: 1n, orden_ruta: 2 }),
      ped(3n, { repartidor_party_id: 10n, estado: 'EN_CAMINO', ruta_reparto_id: 1n, orden_ruta: 3 }),
    ]);
    rutas.push({ id: 1n, repartidor_party_id: 10n, estado: 'EN_CURSO', terminada_en: null, iniciada_en: new Date(), origen: 'INDIVIDUAL' });
    const r: any = await service.listarMios(A);
    expect(r.pedidos.map((p: any) => p.codigo)).toEqual(['CP-3']);
    expect(Array.isArray(r.ruta)).toBe(true); // el trazado de siempre no cambia
    expect(r.rutaReparto).toMatchObject({ id: '1', estado: 'EN_CURSO' });
    expect(r.rutaReparto.pedidos.map((p: any) => [p.codigo, p.estadoFinal])).toEqual([
      ['CP-1', 'ENTREGADO'], ['CP-2', 'NO_ENTREGADO'], ['CP-3', null],
    ]);
    expect(r.rutaReparto.pedidos[0].horaFinal).toEqual(hora);
  });

  it('mios sin pedidos en ruta devuelve rutaReparto null', async () => {
    const { service } = montar([]);
    expect(((await service.listarMios(A)) as any).rutaReparto).toBeNull();
  });

  it('mis-rutas: solo las propias, agrupadas, con distancia, sin montos; ignora el filtro de otro repartidor', async () => {
    const { service, rutas } = montar([
      ped(1n, { repartidor_party_id: 10n, estado: 'ENTREGADO', entregado_en: new Date(), ruta_reparto_id: 1n }),
      ped(2n, { repartidor_party_id: 10n, estado: 'ENTREGADO', entregado_en: new Date(Date.now() + 1000), ruta_reparto_id: 1n }),
      ped(3n, { repartidor_party_id: 20n, estado: 'ENTREGADO', entregado_en: new Date(), ruta_reparto_id: 2n }),
    ]);
    const base = { terminada_en: new Date(), estado: 'TERMINADA', origen: 'INDIVIDUAL', iniciada_en: new Date() };
    rutas.push({ id: 1n, repartidor_party_id: 10n, ...base }, { id: 2n, repartidor_party_id: 20n, ...base });
    const r = await service.listarRutas({ repartidor: '20' }, A, true);
    expect(r.rutas).toHaveLength(1);
    expect(r.rutas[0]).toMatchObject({ id: '1', totalPedidos: 2, entregados: 2, fallidos: 0 });
    expect(r.rutas[0].distanciaKm).toBeGreaterThan(0);
    expect(JSON.stringify(r.rutas)).not.toMatch(/"total"|cobro|monto|efectivo/);
    expect(r.rutas[0].pedidos.map((p) => p.codigo)).toEqual(['CP-1', 'CP-2']);
  });

  it('rutas (caja/admin): ve las de cualquier repartidor y filtra por repartidor', async () => {
    const { service, rutas } = montar([]);
    const base = { terminada_en: new Date(), estado: 'TERMINADA', origen: 'INDIVIDUAL', iniciada_en: new Date() };
    rutas.push({ id: 1n, repartidor_party_id: 10n, ...base }, { id: 2n, repartidor_party_id: 20n, ...base });
    expect((await service.listarRutas({}, CAJA)).rutas).toHaveLength(2);
    expect((await service.listarRutas({ repartidor: '20' }, CAJA)).rutas.map((r) => r.id)).toEqual(['2']);
  });
});
