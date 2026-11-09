jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));


import { BadRequestException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';

const rep = { partyId: 10n, rol: 'REPARTIDOR', debeCambiar: false } as any;
const ped = (id: bigint, orden: number | null, lat: number, estado = 'LISTO') => ({
  id, codigo: `CP-${id}`, estado, orden_ruta: orden, numero_ruta: orden, ruta_reparto_id: null as bigint | null, repartidor_party_id: 10n, entrega_lat: lat, entrega_lng: -77,
  modalidad: 'DELIVERY', zona: null, lineas: [],
});

function montar(pedidos: any[], saltosPrevios = 0) {
  const pendientes = (w: any) =>
    pedidos.filter((p) => p.repartidor_party_id === w.repartidor_party_id && p.orden_ruta != null && w.estado.in.includes(p.estado))
      .sort((a, b) => a.orden_ruta - b.orden_ruta);
  const tx: any = {
    pedido: {
      findMany: jest.fn(async ({ where }: any) =>
        where.ruta_reparto_id !== undefined ? pedidos.filter((p) => p.ruta_reparto_id === where.ruta_reparto_id) : pendientes(where)),
      update: jest.fn(async ({ where, data }: any) => Object.assign(pedidos.find((p) => p.id === where.id), data)),
    },
    rutaReparto: { findFirst: jest.fn(async () => (pedidos.some((p) => p.ruta_reparto_id === 7n) ? { id: 7n } : null)) },
    pedidoEstadoHistorial: { create: jest.fn(), count: jest.fn(async () => saltosPrevios) },
  };
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([]) },
    pedido: {
      findUnique: jest.fn(async ({ where }: any) => pedidos.find((p) => p.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: any) => pendientes(where)[0] ?? null),
    },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  return { service: new RepartosService(prisma, auditoria, new RutaService()), auditoria, tx, pedidos };
}

describe('orden de entrega: solo informativo (sin orden obligatorio)', () => {
  // Antes (v0.4.91): salir/llegue/entregar del #2 respondian 409 ORDEN_RUTA «Primero entrega CP-1».
  it('salir y llegue de cualquier pedido funcionan aunque otro de la ruta vaya antes', async () => {
    const { service } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1, 'EN_CAMINO'), ped(3n, 3, -12.2)]);
    await expect(service.salir('3', rep)).resolves.toMatchObject({ id: '3' });
    await expect(service.llegue('2', rep)).resolves.toBeDefined();
  });

  it('un anulado de la ruta no bloquea: el 3 sale sin haber entregado el 1 ni el 2', async () => {
    const { service } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1, 'ANULADO'), ped(3n, 3, -12.2)]);
    await expect(service.salir('3', rep)).resolves.toMatchObject({ id: '3' });
  });

  it('un pedido sin orden_ruta (flujo viejo) no se bloquea por el orden', async () => {
    const { service } = montar([ped(1n, 1, -12.0), ped(2n, null, -12.1)]);
    await expect(service.salir('2', rep)).resolves.toMatchObject({ id: '2' });
  });

  it('empezar-por reordena por cercanía desde el elegido', async () => {
    // lat: 1 lejos, 2 cerca de 1, 3 cerca de 4, 4 lejos
    const { service, pedidos, auditoria } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.5), ped(3n, 3, -12.01), ped(4n, 4, -12.52)]);
    const r = await service.empezarPor('4', rep);
    expect(r.orden.map((o) => o.codigo)).toEqual(['CP-4', 'CP-2', 'CP-3', 'CP-1']);
    expect(pedidos.map((p) => [p.id, p.orden_ruta])).toEqual([[1n, 4], [2n, 2], [3n, 3], [4n, 1]]);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'EMPEZAR_POR', partyId: 10n }));
  });

  it('empezar-por numera después de los ya entregados de la ruta en curso', async () => {
    const entregado = { ...ped(1n, null, -12.0, 'ENTREGADO'), numero_ruta: 1, ruta_reparto_id: 7n };
    const { service, pedidos } = montar([entregado, ped(2n, 2, -12.1), ped(3n, 3, -12.2)]);
    await service.empezarPor('3', rep);
    expect(pedidos.map((p) => p.numero_ruta)).toEqual([1, 3, 2]);
  });

  it('saltar #2 conserva su numero y toca el siguiente pendiente (#3); el entregado #1 no cambia nada', async () => {
    const entregado = { ...ped(1n, null, -12.0, 'ENTREGADO'), numero_ruta: 1, ruta_reparto_id: 7n };
    const { service, pedidos } = montar([entregado, ped(2n, 2, -12.1), ped(3n, 3, -12.2), ped(4n, 4, -12.3)]);
    const r = await service.saltar('2', { motivo: 'NO_CONTESTA' }, rep);
    expect(r).toMatchObject({ numeroRuta: 2, siguienteNumeroRuta: 3 });
    expect(pedidos.map((p) => p.numero_ruta)).toEqual([1, 2, 3, 4]);
    expect(pedidos[1].orden_ruta).toBe(5);
  });

  it('empezar-por no se puede cuando ya salió con un pedido', async () => {
    const { service } = montar([ped(1n, 1, -12.0, 'EN_CAMINO'), ped(2n, 2, -12.1)]);
    await expect(service.empezarPor('2', rep)).rejects.toMatchObject({ response: { codigo: 'RUTA_EN_CURSO' } });
  });

  it('saltar (atajo opcional, desde cualquier pedido) pasa el pedido al final, deja historial con motivo y audita quién y por qué', async () => {
    const { service, pedidos, tx, auditoria } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1), ped(3n, 3, -12.2)]);
    const r = await service.saltar('1', { motivo: 'NO_CONTESTA' }, rep, '1.2.3.4');
    expect(r.ordenRuta).toBe(4);
    expect(pedidos[0].orden_ruta).toBe(4);
    expect(tx.pedidoEstadoHistorial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pedido_id: 1n, por_party_id: 10n, motivo: 'Salto de orden: Cliente no contesta' }),
    });
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'SALTAR', partyId: 10n, entidadId: 1n, motivo: 'Salto de orden: Cliente no contesta' }),
    );
  });

  it('saltar desde cualquier pedido, exige el detalle en Otro y respeta el tope de 2 saltos', async () => {
    const { service } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1)]);
    await expect(service.saltar('2', { motivo: 'TRAFICO' }, rep)).resolves.toMatchObject({ id: '2' });
    await expect(service.saltar('1', { motivo: 'OTRO' }, rep)).rejects.toBeInstanceOf(BadRequestException);
    const { service: s2 } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1)], 2);
    await expect(s2.saltar('1', { motivo: 'TRAFICO' }, rep)).rejects.toMatchObject({ response: { codigo: 'TOPE_SALTOS' } });
    const { service: s3 } = montar([ped(1n, 1, -12.0), ped(2n, 2, -12.1)], 1);
    await expect(s3.saltar('1', { motivo: 'OTRO', detalle: 'Portón cerrado' }, rep)).resolves.toMatchObject({ ordenRuta: 3 });
  });
});
