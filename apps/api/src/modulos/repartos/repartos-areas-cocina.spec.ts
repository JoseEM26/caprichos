jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';

const hace = (m: number) => new Date(Date.now() - m * 60000);
const u = (rol: string, partyId = 1n) => ({ partyId, rol, debeCambiar: false }) as any;
const com = (id: number, estado: string, nombre: string) => ({ area_id: BigInt(id), estado, area: { nombre } });
const lin = (area: number) => ({ cantidad: 1, despachadas: 0, area_id: BigInt(area) });

const ped = (o: Record<string, any>) => ({
  id: 1n, codigo: 'CP-1', modalidad: 'DELIVERY', estado: 'PREPARANDO', cliente_nombre: 'Lucía', cliente_telefono: '987654321',
  entrega_direccion: 'Av. 1', entrega_referencia: null, entrega_lat: -12, entrega_lng: -77, zona: { codigo: 'Norte' },
  zona_id: 1n, total: 30, pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', paga_con: null, repartidor_party_id: null,
  repartidor: null, creado_en: hace(10), tomado_en: null, salio_en: null, llego_en: null, entregado_en: null,
  motivo_falla: null, mensajesReparto: [], incidentes: [],
  comandas: [com(1, 'DESPEJADA', 'Cocina'), com(2, 'DESPEJADA', 'Barra'), com(3, 'EN_COCINA', 'Postres')],
  lineas: [lin(1), lin(2), lin(3)], ...o,
});

function montar(pedidos: any[]) {
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([]) },
    userAccount: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    pedido: { findMany: jest.fn().mockResolvedValue(pedidos), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    rutaReparto: { findFirst: jest.fn().mockResolvedValue(null) },
    pedidoEstadoHistorial: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new RepartosService(prisma, { registrar: jest.fn() } as any, new (RutaService as any)(prisma), { emitirAdmin: jest.fn() } as any);
  return { prisma, service };
}

describe('Repartos: check «Cocina» por área', () => {
  it('seguimiento (admin): areas, areasListas, areasTotal y completo, en una sola consulta de pedidos', async () => {
    const { service, prisma } = montar([ped({}), ped({ id: 2n, comandas: [com(1, 'DESPEJADA', 'Cocina')], lineas: [lin(1)] })]);
    const r = await service.listarSeguimiento(u('ADMIN'));
    expect(prisma.pedido.findMany).toHaveBeenCalledTimes(1); // sin N+1
    const inc = prisma.pedido.findMany.mock.calls[0][0].include;
    expect(inc.comandas.select.area.select).toEqual({ nombre: true });
    const [a, b] = r.pedidos as any[];
    expect(a).toMatchObject({ areasListas: 2, areasTotal: 3, completo: false });
    expect(a.areas.map((x: any) => [x.areaNombre, x.listo])).toEqual([['Cocina', true], ['Barra', true], ['Postres', false]]);
    expect(b).toMatchObject({ areasListas: 1, areasTotal: 1, completo: true });
  });

  it('solo expone areaId, areaNombre, listo y despachada (nada de líneas ni notas)', async () => {
    const { service } = montar([ped({})]);
    const r: any = await service.listarSeguimiento(u('CAJERO'));
    expect(Object.keys(r.pedidos[0].areas[0]).sort()).toEqual(['areaId', 'areaNombre', 'despachada', 'listo']);
  });

  it('repartidor (mios y disponibles) trae el check y consulta comandas en el mismo include', async () => {
    const { service, prisma } = montar([ped({ estado: 'LISTO', comandas: [com(1, 'DESPEJADA', 'Cocina')], lineas: [lin(1)] })]);
    const r: any = await service.listarMios(u('REPARTIDOR', 9n));
    expect(r.pedidos[0]).toMatchObject({ areasListas: 1, areasTotal: 1, completo: true });
    for (const call of prisma.pedido.findMany.mock.calls) expect(call[0].include.comandas).toBeDefined();
    const d: any[] = await service.listarDisponibles(u('REPARTIDOR', 9n));
    expect(d[0]).toMatchObject({ areasTotal: 1, completo: true });
  });

  it('admin listarTodos incluye el check', async () => {
    const { service } = montar([ped({ estado: 'LISTO' })]);
    const r: any[] = await service.listarTodos({} as any, u('ADMIN'));
    expect(r[0]).toMatchObject({ areasListas: 2, areasTotal: 3, completo: false });
  });

  it('pedido sin comandas: areasTotal 0 y no completo', async () => {
    const { service } = montar([ped({ estado: 'COLA', comandas: [] })]);
    const r: any = await service.listarSeguimiento(u('ADMIN'));
    expect(r.pedidos[0]).toMatchObject({ areas: [], areasTotal: 0, completo: false });
  });
});
