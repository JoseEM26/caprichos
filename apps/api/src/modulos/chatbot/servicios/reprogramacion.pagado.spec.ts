jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ReprogramacionService } from './reprogramacion.service';

function montar(pedido: any) {
  const prisma: any = {
    pedido: { findUnique: jest.fn().mockResolvedValue(pedido), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    mensajeReparto: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const avisos: any = { avisar: jest.fn(), despertar: jest.fn() };
  return { prisma, avisos, service: new ReprogramacionService(prisma, avisos, { emitirAdmin: jest.fn() } as any) };
}

describe('Reprogramación automática: un pedido pagado nunca se anula solo', () => {
  const pagado = { codigo: 'CP-W1', estado: 'LISTO', pago_estado: 'PAGADO', cobros: [{ credito_personal: false }] };

  it.each(['NO', 'SIN_RESPUESTA', 'TOPE'] as const)('%s con pedido pagado: no anula, cierra la pregunta y avisa a Caja', async (motivo) => {
    const { service, prisma, avisos } = montar(pagado);
    expect(await service.cancelar(5n, motivo)).toBe(false);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    expect(avisos.avisar).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.updateMany).toHaveBeenCalled();
    expect(prisma.notificacion.create.mock.calls[0][0].data).toMatchObject({ tipo: 'REVISAR_DEVOLUCION', rol_destino: 'CAJERO' });
  });

  it('pago coordinado sin cobro también cuenta como pagado', async () => {
    const { service, prisma } = montar({ codigo: 'CP-W2', estado: 'LISTO', pago_estado: 'COORDINADO', cobros: [] });
    expect(await service.cancelar(5n, 'SIN_RESPUESTA')).toBe(false);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('pedido sin pagar: se anula como siempre', async () => {
    const { service, prisma } = montar({ codigo: 'CP-W3', estado: 'LISTO', pago_estado: 'PENDIENTE', cobros: [] });
    prisma.incidenteEntrega = { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() };
    prisma.pedidoEstadoHistorial = { create: jest.fn() };
    await service.cancelar(5n, 'NO');
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO' }) }));
  });
});
