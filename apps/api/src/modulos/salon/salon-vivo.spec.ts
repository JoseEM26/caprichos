jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { armarSalonVivo, EntradaSalonVivo, PedidoDia } from './salon-vivo.util';
import { SalonVivoService } from './salon-vivo.service';
import { MATRIZ } from '../acceso/permisos';

const ahora = new Date('2026-11-21T20:00:00-05:00');
const hace = (min: number) => new Date(ahora.getTime() - min * 60000);

const el = (id: string, tipo: string, extra: Record<string, unknown> = {}) => ({
  id, tipo, nombre: null, x: 0, y: 0, ancho: 2, alto: 2, numero: null, asientos: null, activo: true, ...extra,
});

const pisos = [
  {
    id: '1', nombre: 'Piso 1', cuadriculaAncho: 20, cuadriculaAlto: 12,
    elementos: [
      el('1', 'MESA', { numero: 1, nombre: 'Mesa 1', asientos: 4 }),
      el('2', 'MESA', { numero: 2, nombre: 'Mesa 2', asientos: 2 }),
      el('3', 'MESA', { numero: 3, nombre: 'Mesa 3', asientos: 4 }),
      el('4', 'MESA', { numero: 4, nombre: 'Mesa 4', asientos: 4 }),
      el('5', 'MESA', { numero: 5, nombre: 'Mesa 5', asientos: 4, activo: false }),
      el('6', 'CAJA'),
    ],
  },
];

const ped = (id: number, extra: Partial<PedidoDia> = {}): PedidoDia => ({
  id: BigInt(id), codigo: `CP-W${id}`, modalidad: 'MESA', estado: 'COLA', cliente_nombre: 'Lucía Pérez Gómez', pago_estado: 'PENDIENTE',
  creado_en: hace(12), pasa_cocina_en: hace(10), listo_en: null, entregado_mesa_en: null, entregado_en: null, cobro_mozo_en: null,
  despachado_en: null, espera_personas: null, mesas: [], comandas: [], lineas: [{ nombre: 'Capuccino', cantidad: 2 }], ...extra,
});

const entrada = (pedidos: PedidoDia[], reservas: EntradaSalonVivo['reservas'] = []): EntradaSalonVivo => ({ ahora, pisos, pedidos, reservas, cajaAbierta: true });

describe('armarSalonVivo', () => {
  it('deriva el estado real de cada mesa y deja fuera las inactivas', () => {
    const r = armarSalonVivo(entrada([
      ped(1, { mesas: [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }], comandas: [{ estado: 'EN_COCINA', area: { nombre: 'Bebidas' } }, { estado: 'DESPEJADA', area: { nombre: 'Postres' } }] }),
      ped(2, { estado: 'ENTREGADO', entregado_mesa_en: hace(3), mesas: [{ mesaId: 2n, nombre: 'Mesa 2', abierta: true }] }),
      ped(3, { estado: 'ENTREGADO', entregado_mesa_en: hace(8), cobro_mozo_en: hace(1), mesas: [{ mesaId: 3n, nombre: 'Mesa 3', abierta: true }] }),
    ], [{ id: 9n, nombre: 'Marco', personas: 3, hora: new Date('2026-11-21T21:00:00-05:00'), pedido_id: null, mesas: [{ mesaId: 4n, nombre: 'Mesa 4' }] }]));
    const est = Object.fromEntries(r.mesas.map((m) => [m.numero, m.estado]));
    expect(est).toEqual({ 1: 'ESPERANDO', 2: 'COMIENDO', 3: 'POR_COBRAR', 4: 'RESERVADA' });
    expect(r.mesas).toHaveLength(4);
    expect(r.mesas[0].pedido).toMatchObject({ codigo: 'CP-W1', minutos: 10, areasPendientes: ['Bebidas'] });
    expect(r.mesas[3].reserva).toEqual({ hora: '21:00', nombre: 'Marco', personas: 3 });
    expect(r.conteos).toMatchObject({ mesasOcupadas: 3, mesasTotal: 4 });
  });

  it('clasifica caja, cocina, despacho y reparto; ignora anulados y pedidos sin pagar en línea', () => {
    const r = armarSalonVivo(entrada([
      ped(10, { modalidad: 'LLEVAR', estado: 'COLA' }),
      ped(11, { modalidad: 'LLEVAR', estado: 'LISTO', pago_estado: 'PAGADO' }),
      ped(12, { modalidad: 'DELIVERY', estado: 'EN_CAMINO', pago_estado: 'PAGADO' }),
      ped(13, { estado: 'ANULADO' }),
      ped(14, { estado: 'POR_PAGAR' }),
      ped(15, { modalidad: 'DELIVERY', estado: 'ENTREGADO', pago_estado: 'PAGADO', pasa_cocina_en: hace(40), listo_en: hace(30) }),
    ]));
    expect(r.caja.map((p) => p.codigo)).toEqual(['CP-W10']);
    expect(r.cocina.map((p) => p.codigo)).toEqual(['CP-W10']);
    expect(r.despacho.map((p) => p.codigo)).toEqual(['CP-W11']);
    expect(armarSalonVivo(entrada([ped(40, { estado: 'LISTO', mesas: [{ mesaId: 3n, nombre: 'Mesa 3', abierta: true }] })])).despacho[0].mesaIds).toEqual(['3']);
    expect(r.enReparto.map((p) => p.codigo)).toEqual(['CP-W12']);
    expect(r.conteos).toMatchObject({ pedidosHoy: 4, entregadosHoy: 1, deliveryEntregadosHoy: 1, minutosCocinaPromedio: 10 });
  });

  it('calcula personas con la reserva o la espera, tope en los asientos; sin dato queda null', () => {
    const r = armarSalonVivo(entrada([
      ped(20, { mesas: [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }], espera_personas: 9 }),
      ped(21, { mesas: [{ mesaId: 2n, nombre: 'Mesa 2', abierta: true }] }),
    ]));
    expect(r.mesas.find((m) => m.numero === 1)!.pedido!.personas).toBe(4);
    expect(r.mesas.find((m) => m.numero === 2)!.pedido!.personas).toBeNull();
  });

  it('suma la carga por área solo de comandas sin despejar y no expone datos personales', () => {
    const r = armarSalonVivo(entrada([
      ped(30, { comandas: [{ estado: 'EN_COCINA', area: { nombre: 'Bebidas' } }, { estado: 'EN_COCINA', area: { nombre: 'Salados' } }] }),
      ped(31, { comandas: [{ estado: 'EN_COCINA', area: { nombre: 'Bebidas' } }, { estado: 'DESPEJADA', area: { nombre: 'Salados' } }] }),
    ]));
    expect(r.cargaCocina).toEqual([{ area: 'Bebidas', pendientes: 2 }, { area: 'Salados', pendientes: 1 }]);
    expect(r.cocina[0].cliente).toBe('Lucía');
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/telefono|dni|Pérez/i);
  });
});

describe('SalonVivoService', () => {
  it('lee de Prisma solo el día de Lima y entrega el plano activo', async () => {
    const prisma: any = {
      piso: { findMany: jest.fn().mockResolvedValue([{ id: 1n, nombre: 'Piso 1', cuadricula_ancho: 20, cuadricula_alto: 12, elementos: [{ id: 7n, tipo: 'MESA', nombre: 'Mesa 1', x: 1, y: 1, ancho: 2, alto: 2, numero: 1, asientos: 4, activo: true }] }]) },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      caja: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const r = await new SalonVivoService(prisma).obtener(ahora);
    expect(prisma.piso.findMany.mock.calls[0][0].where).toEqual({ activo: true });
    const w = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(w.creado_en.gte.toISOString()).toBe('2026-11-21T05:00:00.000Z');
    expect(w.es_personal).toBe(false);
    expect(r.cajaAbierta).toBe(false);
    expect(r.mesas[0]).toMatchObject({ id: '7', estado: 'LIBRE', asientos: 4 });
  });
});

describe('permiso salon_vivo/ver', () => {
  it('lo tienen ADMIN, SUPERVISOR y CAJERO y no el resto', () => {
    expect(MATRIZ.ADMIN).toContain('salon_vivo/ver');
    expect(MATRIZ.CAJERO).toContain('salon_vivo/ver');
    expect(MATRIZ.SUPERVISOR).toContain('salon_vivo/ver');
    for (const rol of ['MOZO', 'COCINA', 'ALMACEN', 'REPARTIDOR', 'MARKETING']) expect(MATRIZ[rol]).not.toContain('salon_vivo/ver');
  });
});
