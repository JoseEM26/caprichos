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

  it('preparando con todas las áreas despejadas cuenta como LISTO (sin pulsar «Despachar»)', () => {
    const mesa4 = [{ mesaId: 4n, nombre: 'Mesa 4', abierta: true }];
    const todas = [{ estado: 'DESPEJADA', area: { nombre: 'Bebidas' } }, { estado: 'DESPEJADA', area: { nombre: 'Salados' } }];
    const r = armarSalonVivo(entrada([ped(1185, { estado: 'PREPARANDO', mesas: mesa4, comandas: todas })]));
    expect(r.despacho.map((p) => p.codigo)).toEqual(['CP-W1185']);
    expect(r.cocina).toHaveLength(0);
    expect(r.despacho[0].estado).toBe('LISTO');
    const media = armarSalonVivo(entrada([ped(1186, { estado: 'PREPARANDO', mesas: mesa4, comandas: [todas[0], { estado: 'EN_COCINA', area: { nombre: 'Salados' } }] })]));
    expect(media.cocina).toHaveLength(1);
    expect(media.despacho).toHaveLength(0);
  });

  it('transiciones del pedido de mesa: cocina → LISTO → ENTREGADO (con o sin «entregado en mesa») → comiendo', () => {
    const mesa1 = [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }];
    const est = (p: PedidoDia) => armarSalonVivo(entrada([p])).mesas.find((m) => m.numero === 1)!.estado;
    expect(est(ped(1, { estado: 'PREPARANDO', mesas: mesa1 }))).toBe('ESPERANDO');
    expect(est(ped(1, { estado: 'LISTO', listo_en: hace(1), mesas: mesa1 }))).toBe('ESPERANDO');
    expect(armarSalonVivo(entrada([ped(1, { estado: 'LISTO', mesas: mesa1 })])).despacho).toHaveLength(1);
    expect(est(ped(1, { estado: 'LISTO', entregado_mesa_en: hace(1), mesas: mesa1 }))).toBe('COMIENDO');
    // ENTREGADO sin entregado_mesa_en (antes se quedaba «esperando» para siempre)
    expect(est(ped(1, { estado: 'ENTREGADO', mesas: mesa1 }))).toBe('COMIENDO');
    expect(est(ped(1, { estado: 'ENTREGADO', cobro_mozo_en: hace(1), mesas: mesa1 }))).toBe('POR_COBRAR');
    // mesa cerrada: el cliente se va
    expect(est(ped(1, { estado: 'ENTREGADO', mesas: [{ mesaId: 1n, nombre: 'Mesa 1', abierta: false }] }))).toBe('LIBRE');
  });

  it('si una mesa tiene un pedido viejo entregado y uno nuevo en cocina, manda el nuevo sin depender del orden', () => {
    const mesa1 = [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }];
    const viejo = ped(1, { estado: 'ENTREGADO', creado_en: hace(60), mesas: mesa1 });
    const nuevo = ped(2, { estado: 'COLA', creado_en: hace(5), mesas: mesa1 });
    for (const orden of [[viejo, nuevo], [nuevo, viejo]]) {
      expect(armarSalonVivo(entrada(orden)).mesas.find((m) => m.numero === 1)!.pedido!.codigo).toBe('CP-W2');
    }
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

describe('bebidas del pedido', () => {
  it('cuenta las unidades de la categoría Bebidas en la mesa y en el pedido', () => {
    const lineas = [
      { nombre: 'Capuccino', cantidad: 2, producto: { categoria: { nombre: 'Bebidas calientes' } } },
      { nombre: 'Frappé', cantidad: 1, producto: { categoria: { nombre: 'Bebidas' } } },
      { nombre: 'Dona', cantidad: 4, producto: { categoria: { nombre: 'Donas' } } },
    ];
    const r = armarSalonVivo(entrada([ped(80, { lineas, mesas: [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }] })]));
    expect(r.mesas[0].pedido?.bebidas).toBe(3);
    expect(r.cocina[0].bebidas).toBe(3);
  });
});

describe('avatar del cliente', () => {
  const avatares = new Map([['77', { url: '/archivos/avatar-77.png', config: { genero: 'mujer' } }]]);
  it('sale en el pedido vivo y en el de la mesa; sin avatar o sin cliente es null', () => {
    const r = armarSalonVivo({ ...entrada([
      ped(50, { party_id: 77n, mesas: [{ mesaId: 1n, nombre: 'Mesa 1', abierta: true }] }),
      ped(51, { party_id: 88n, mesas: [{ mesaId: 2n, nombre: 'Mesa 2', abierta: true }] }),
      ped(52, { modalidad: 'LLEVAR' }),
    ]), avatares });
    expect(r.cocina.map((p) => p.avatar)).toEqual([{ url: '/archivos/avatar-77.png', config: { genero: 'mujer' } }, null, null]);
    expect(r.mesas.find((m) => m.numero === 1)!.pedido!.avatar).toEqual({ url: '/archivos/avatar-77.png', config: { genero: 'mujer' } });
    expect(r.mesas.find((m) => m.numero === 2)!.pedido!.avatar).toBeNull();
  });

  it('el servicio consulta Person una sola vez para todos los pedidos y no filtra otros datos', async () => {
    const prisma: any = {
      piso: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([
        { ...ped(60, { party_id: 5n }), mesas: [] }, { ...ped(61, { party_id: 5n }), mesas: [] }, { ...ped(62, { party_id: 6n }), mesas: [] }, { ...ped(63), mesas: [] },
      ]) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      caja: { findFirst: jest.fn().mockResolvedValue(null) },
      person: { findMany: jest.fn().mockResolvedValue([
        { party_id: 5n, avatar_url: '/archivos/a5.png', avatar_config: { genero: 'hombre' } },
        { party_id: 6n, avatar_url: null, avatar_config: null },
      ]) },
    };
    const r = await new SalonVivoService(prisma).obtener(ahora);
    expect(prisma.person.findMany).toHaveBeenCalledTimes(1);
    const q = prisma.person.findMany.mock.calls[0][0];
    expect(q.where.party_id.in).toEqual([5n, 6n]);
    expect(Object.keys(q.select).sort()).toEqual(['avatar_config', 'avatar_url', 'party_id']);
    expect(r.cocina.map((p) => p.avatar?.url ?? null)).toEqual(['/archivos/a5.png', '/archivos/a5.png', null, null]);
    expect(JSON.stringify(r)).not.toMatch(/party_id|telefono/i);
  });

  it('un pedido sin party se une por el celular del pedido con la cuenta de ese celular, sin exponer el celular', async () => {
    const prisma: any = {
      piso: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([{ ...ped(70, { cliente_telefono: '987654321' }), mesas: [] }]) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) },
      caja: { findFirst: jest.fn().mockResolvedValue(null) },
      customerAccount: { findMany: jest.fn().mockResolvedValue([{ telefono: '987654321', party_id: 9n }]) },
      person: { findMany: jest.fn().mockResolvedValue([{ party_id: 9n, avatar_url: '/archivos/a9.png', avatar_config: { genero: 'mujer' } }]) },
    };
    const r = await new SalonVivoService(prisma).obtener(ahora);
    expect(prisma.customerAccount.findMany.mock.calls[0][0].where).toMatchObject({ telefono: { in: ['987654321'] }, activo: true });
    expect(prisma.person.findMany.mock.calls[0][0].where.party_id.in).toEqual([9n]);
    expect(r.cocina[0].avatar?.url).toBe('/archivos/a9.png');
    expect(JSON.stringify(r)).not.toMatch(/987654321|party_id|telefono/i);
  });

  it('sin pedidos con cliente no consulta Person', async () => {
    const prisma: any = {
      piso: { findMany: jest.fn().mockResolvedValue([]) }, pedido: { findMany: jest.fn().mockResolvedValue([]) },
      reserva: { findMany: jest.fn().mockResolvedValue([]) }, caja: { findFirst: jest.fn().mockResolvedValue(null) },
      person: { findMany: jest.fn() },
    };
    await new SalonVivoService(prisma).obtener(ahora);
    expect(prisma.person.findMany).not.toHaveBeenCalled();
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
