jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { idOpcion } from './rutas-sugeridas';

type Fila = { id: bigint; codigo: string; modalidad: string; estado: string; repartidor_party_id: bigint | null;
  anulado_en: null; motivo_falla: null; entrega_lat: number | null; entrega_lng: number | null };

function montar(maxPedidos = 3) {
  const filas: Fila[] = [1n, 2n, 3n].map((id) => ({
    id, codigo: `CP-${id}`, modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null,
    anulado_en: null, motivo_falla: null, entrega_lat: -12.01, entrega_lng: -77.0,
  }));
  // Cola: simula el bloqueo FOR UPDATE (una transacción a la vez)
  let cola: Promise<unknown> = Promise.resolve();
  const historial: any[] = [];
  const tx: any = {
    $queryRaw: jest.fn(async () => filas.map((f) => ({ ...f }))),
    person: { findMany: jest.fn().mockResolvedValue([]) },
    pedido: {
      count: jest.fn(async ({ where }: any) =>
        filas.filter((f) => f.repartidor_party_id === where.repartidor_party_id).length),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const ok = filas.filter((f) => where.id.in.includes(f.id) && f.estado === 'LISTO' && f.repartidor_party_id === null);
        ok.forEach((f) => (f.repartidor_party_id = data.repartidor_party_id));
        return { count: ok.length };
      }),
      findMany: jest.fn(async () => filas.map((f) => ({ ...f, pago_estado: 'PAGADO', total: 10, creado_en: new Date(), lineas: [] }))),
    },
    pedidoEstadoHistorial: { create: jest.fn(async (a: any) => historial.push(a)) },
    rutaReparto: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }), update: jest.fn(), delete: jest.fn() },
  };
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([{ clave: 'rep_max_pedidos', valor: maxPedidos }]) },
    userAccount: { findUnique: jest.fn().mockResolvedValue({ rol: 'REPARTIDOR', activo: true }) },
    $transaction: jest.fn((fn: any) => {
      const r = cola.then(() => fn(tx));
      cola = r.catch(() => undefined);
      return r;
    }),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const gateway: any = { emitirAdmin: jest.fn() };
  const service = new RepartosService(prisma, auditoria, new RutaService(), gateway);
  return { service, filas, auditoria, gateway, historial };
}

const rep = (id: bigint, rol = 'REPARTIDOR') => ({ partyId: id, rol, debeCambiar: false }) as any;
const ids = ['1', '2', '3'];
const op = idOpcion(ids);

describe('tomarRutaSugerida', () => {
  it('asigna todos los pedidos en una transacción, audita y emite eventos', async () => {
    const { service, filas, auditoria, gateway } = montar();
    const r = await service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n));
    expect(filas.every((f) => f.repartidor_party_id === 101n)).toBe(true);
    expect(r.tomados).toHaveLength(3);
    expect(auditoria.registrar).toHaveBeenCalledTimes(3);
    expect(gateway.emitirAdmin).toHaveBeenCalledWith('reparto:rutas', expect.objectContaining({ idOpcion: op }));
    expect(gateway.emitirAdmin.mock.calls.filter((c: any[]) => c[0] === 'pedido:estado')).toHaveLength(3);
  });

  it('dos tomas simultáneas: solo una gana y la otra recibe 409 RUTA_YA_TOMADA sin cambiar nada', async () => {
    const { service, filas } = montar();
    const res = await Promise.allSettled([
      service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n)),
      service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(102n)),
    ]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const perdida = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(perdida.reason).toBeInstanceOf(ConflictException);
    expect(perdida.reason.getResponse()).toMatchObject({ codigo: 'RUTA_YA_TOMADA' });
    expect(perdida.reason.getResponse().pedidos).toHaveLength(3);
    expect(new Set(filas.map((f) => f.repartidor_party_id)).size).toBe(1);
  });

  it('si solo uno cambió, aborta todo y dice cuál', async () => {
    const { service, filas } = montar();
    filas[1].repartidor_party_id = 200n;
    await expect(service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n))).rejects.toMatchObject({
      response: { codigo: 'RUTA_YA_TOMADA', pedidos: [expect.objectContaining({ pedidoId: '2', motivo: 'OTRO_REPARTIDOR' })] },
    });
    expect(filas[0].repartidor_party_id).toBeNull();
  });

  it('es idempotente: repetir no escribe ni emite de nuevo', async () => {
    const { service, auditoria, gateway } = montar();
    await service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n));
    auditoria.registrar.mockClear();
    gateway.emitirAdmin.mockClear();
    const r = await service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n));
    expect(r.tomados).toHaveLength(3);
    expect(auditoria.registrar).not.toHaveBeenCalled();
    expect(gateway.emitirAdmin).not.toHaveBeenCalled();
  });

  it('respeta rep_max_pedidos contando lo que ya lleva', async () => {
    const { service, filas } = montar(2);
    await expect(service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(101n))).rejects.toMatchObject({
      response: { codigo: 'LIMITE_PEDIDOS' },
    });
    expect(filas.every((f) => f.repartidor_party_id === null)).toBe(true);
  });

  it('rechaza una opción cuyo id no coincide con los pedidos', async () => {
    const { service } = montar();
    await expect(service.tomarRutaSugerida('ruta-x', { pedidoIds: ids }, rep(101n))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('el repartidor no puede asignar a otro; Caja sí y debe elegir uno', async () => {
    const { service, filas } = montar();
    await expect(
      service.tomarRutaSugerida(op, { pedidoIds: ids, repartidorPartyId: '999' }, rep(101n)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.tomarRutaSugerida(op, { pedidoIds: ids }, rep(1n, 'CAJERO'))).rejects.toBeInstanceOf(BadRequestException);
    await service.tomarRutaSugerida(op, { pedidoIds: ids, repartidorPartyId: '105' }, rep(1n, 'CAJERO'));
    expect(filas.every((f) => f.repartidor_party_id === 105n)).toBe(true);
  });
});
