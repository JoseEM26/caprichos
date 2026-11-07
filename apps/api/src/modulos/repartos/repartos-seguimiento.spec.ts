jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { ForbiddenException } from '@nestjs/common';
import { validate } from 'class-validator';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { ReasignarPedidoDto } from './dto/reasignar-pedido.dto';
import { LiberarPedidoDto } from './dto/liberar-pedido.dto';
import { MATRIZ } from '../acceso/permisos';

const hace = (m: number) => new Date(Date.now() - m * 60000);
const u = (rol: string, partyId = 1n) => ({ partyId, rol, debeCambiar: false }) as any;

const ped = (o: Record<string, any>) => ({
  id: 1n, codigo: 'CP-1', modalidad: 'DELIVERY', estado: 'LISTO', cliente_nombre: 'Lucía', cliente_telefono: '987654321',
  entrega_direccion: 'Av. 1', entrega_referencia: null, entrega_lat: -12, entrega_lng: -77, zona: { codigo: 'Norte' },
  zona_id: 1n, total: 30, pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', paga_con: null, repartidor_party_id: null,
  repartidor: null, creado_en: hace(10), tomado_en: null, salio_en: null, llego_en: null, entregado_en: null,
  motivo_falla: null, lineas: [], mensajesReparto: [], incidentes: [], ...o,
});

function montar(pedidos: any[] = [], cuentas: any[] = []) {
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([{ clave: 'rep_max_pedidos', valor: 3 }]) },
    userAccount: { findMany: jest.fn(async ({ where }: any) => cuentas.filter((c) => c.rol === where.rol)) , findUnique: jest.fn() },
    pedido: { findMany: jest.fn().mockResolvedValue(pedidos), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0), updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: jest.fn() },
    pedidoEstadoHistorial: { create: jest.fn() },
    rutaReparto: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }), update: jest.fn() },
  };
  const service = new RepartosService(prisma, { registrar: jest.fn() } as any, new (RutaService as any)(prisma), { emitirAdmin: jest.fn() } as any);
  return { prisma, service };
}

describe('Seguimiento de repartos: permiso repartos/seguir', () => {
  it('lo tienen ADMIN, SUPERVISOR, CAJERO y MOZO, y nadie más', () => {
    for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('repartos/seguir');
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('repartos/seguir');
  });

  it('el MOZO solo lee: ni tomar ni liquidar', () => {
    expect(MATRIZ.MOZO).not.toContain('repartos/tomar');
    expect(MATRIZ.MOZO).not.toContain('repartos/liquidar');
    expect(MATRIZ.CAJERO).not.toContain('repartos/tomar');
  });

  it('el motivo es obligatorio al soltar y al reasignar', async () => {
    expect((await validate(Object.assign(new LiberarPedidoDto(), { motivo: '' }))).length).toBeGreaterThan(0);
    expect((await validate(Object.assign(new ReasignarPedidoDto(), { repartidorPartyId: '5', motivo: '' }))).length).toBeGreaterThan(0);
  });
});

describe('Seguimiento: panel y lista de hoy', () => {
  it('el panel acepta MOZO y CAJERO; el REPARTIDOR sigue con 403', async () => {
    const { service, prisma } = montar();
    await expect(service.obtenerPanelRepartidores(u('MOZO'))).resolves.toBeDefined();
    await expect(service.obtenerPanelRepartidores(u('CAJERO'))).resolves.toBeDefined();
    prisma.pedido.findMany.mockClear();
    await expect(service.obtenerPanelRepartidores(u('REPARTIDOR'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
    await expect(service.listarSeguimiento(u('REPARTIDOR'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('agrupa por sección todos los estados del día y el MOZO no ve teléfonos', async () => {
    const rep = { id: 9n, persona: { nombres: 'Ana', apellidos: 'Paz' } };
    const { service } = montar([
      ped({ id: 1n, estado: 'LISTO' }),
      ped({ id: 2n, estado: 'COLA' }),
      ped({ id: 3n, estado: 'LISTO', repartidor_party_id: 9n, repartidor: rep, tomado_en: hace(5) }),
      ped({ id: 4n, estado: 'EN_CAMINO', repartidor_party_id: 9n, repartidor: rep, salio_en: hace(3) }),
      ped({ id: 5n, estado: 'ENTREGADO', repartidor_party_id: 9n, repartidor: rep, entregado_en: hace(1) }),
      ped({ id: 6n, estado: 'LISTO', motivo_falla: 'No sale' }),
    ]);
    const r = await service.listarSeguimiento(u('MOZO'));
    expect(r.pedidos.map((p: any) => p.seccion)).toEqual(['ESPERANDO', 'PREPARACION', 'EN_CAMINO', 'EN_CAMINO', 'ENTREGADOS', 'INCIDENTE']);
    expect(r.pedidos[2].repartidor?.nombre).toBe('Ana Paz');
    expect(r.pedidos.every((p: any) => p.cliente_telefono === null)).toBe(true);
    const caja = await service.listarSeguimiento(u('CAJERO'));
    expect(caja.pedidos[0].cliente_telefono).toBe('987654321');
  });
});

describe('Seguimiento: excepciones y admin repartidor', () => {
  it('MOZO y SUPERVISOR no pueden soltar ni reasignar; CAJERO sí llega a validar', async () => {
    const { service } = montar();
    await expect(service.liberarPedido('1', { motivo: 'x' } as any, u('MOZO'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reasignarPedido('1', { repartidorPartyId: '2', motivo: 'x' } as any, u('SUPERVISOR'))).rejects.toBeInstanceOf(ForbiddenException);
    const { service: s2, prisma } = montar();
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(s2.liberarPedido('1', { motivo: 'x' } as any, u('CAJERO'))).rejects.not.toBeInstanceOf(ForbiddenException);
  });

  it('el ADMIN toma un pedido (con el límite de siempre) y aparece en el panel como «(admin)»', async () => {
    const { service, prisma } = montar();
    prisma.pedido.count.mockResolvedValue(3);
    await expect(service.tomarPedido('1', u('ADMIN', 77n))).rejects.toMatchObject({ response: { codigo: 'LIMITE_PEDIDOS' } });
    prisma.pedido.count.mockResolvedValue(0);
    prisma.pedido.findUniqueOrThrow.mockResolvedValue(ped({ repartidor_party_id: 77n }));
    const r: any = await service.tomarPedido('1', u('ADMIN', 77n));
    expect(r.repartidor_party_id).toBe('77');
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ repartidor_party_id: 77n }) }));

    const rep = { id: 77n, persona: { nombres: 'Jose', apellidos: 'Espinoza' } };
    const { service: s2 } = montar(
      [ped({ id: 1n, repartidor_party_id: 77n, repartidor: rep, tomado_en: hace(2) })],
      [{ party_id: 77n, rol: 'ADMIN', activo: true, party: { persona: rep.persona } }],
    );
    const panel: any = await s2.obtenerPanelRepartidores(u('CAJERO'));
    expect(panel.repartidores).toHaveLength(1);
    expect(panel.repartidores[0]).toMatchObject({ nombre: 'Jose Espinoza (admin)', es_admin: true, libre: false });
  });
});
