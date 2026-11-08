jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { MensajesService } from './mensajes.service';

/** Auditoría de stock: cancelar un pedido desde WhatsApp tiene que devolver stock y puntos, como cualquier anulación. */
describe('MensajesService.aplicarCambio CANCELAR devuelve stock y puntos', () => {
  const armar = (stock: any, puntos: any) => {
    const prisma: any = {
      solicitudCambio: { findFirst: jest.fn().mockResolvedValue({ id: 1n, tipo: 'CANCELAR', detalle: 'ya no' }), update: jest.fn() },
      pedido: { findUnique: jest.fn().mockResolvedValue({ id: 7n, codigo: 'CP-W007' }), update: jest.fn() },
    };
    const gateway: any = { enviarTexto: jest.fn().mockResolvedValue({}) };
    const svc: any = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, { emitirAdmin: jest.fn() } as any, undefined, undefined, undefined, stock, puntos);
    svc.cargar = jest.fn().mockResolvedValue({ id: 1n, telefono: '999' });
    svc.exigirLibreOMio = jest.fn();
    svc.pedidoDelChat = jest.fn().mockResolvedValue({ pedido: { id: '7' } });
    svc.auditar = jest.fn();
    return { svc: svc as MensajesService, prisma };
  };
  const usuario: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

  it('anula el pedido y revierte stock y puntos', async () => {
    const stock = { revertirPorPedido: jest.fn().mockResolvedValue({}) };
    const puntos = { reversarPorPedido: jest.fn().mockResolvedValue({}) };
    const { svc, prisma } = armar(stock, puntos);
    await svc.aplicarCambio('1', usuario);
    expect(prisma.pedido.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO' }) }));
    expect(stock.revertirPorPedido).toHaveBeenCalledWith(7n);
    expect(puntos.reversarPorPedido).toHaveBeenCalledWith(7n);
  });

  it('si la devolución falla, la cancelación igual queda hecha', async () => {
    const stock = { revertirPorPedido: jest.fn().mockRejectedValue(new Error('boom')) };
    const { svc } = armar(stock, { reversarPorPedido: jest.fn() });
    await expect(svc.aplicarCambio('1', usuario)).resolves.toEqual({ ok: true });
  });
});
