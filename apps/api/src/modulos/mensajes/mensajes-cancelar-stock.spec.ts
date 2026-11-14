jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { BadRequestException } from '@nestjs/common';
import { MensajesService } from './mensajes.service';

/**
 * Cancelar un pedido desde WhatsApp (Mensajes) pasa por la MISMA anulación que Pedidos/Caja (PedidosEstadoService.cambiarEstado):
 * ella valida el estado, anula el cobro, libera mesas, deja historial, devuelve stock y puntos y pide el destino del dinero.
 */
describe('MensajesService.aplicarCambio CANCELAR usa la anulación de pedidos', () => {
  const armar = (cambiarEstado: jest.Mock) => {
    const prisma: any = {
      solicitudCambio: { findFirst: jest.fn().mockResolvedValue({ id: 1n, tipo: 'CANCELAR', detalle: 'ya no lo quiero' }), update: jest.fn() },
      pedido: { findUnique: jest.fn().mockResolvedValue({ id: 7n, codigo: 'CP-W007' }), update: jest.fn() },
    };
    const gateway: any = { enviarTexto: jest.fn().mockResolvedValue({}) };
    const svc: any = new MensajesService(prisma, { registrar: jest.fn() } as any, gateway, { emitirAdmin: jest.fn() } as any, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { cambiarEstado } as any);
    svc.cargar = jest.fn().mockResolvedValue({ id: 1n, telefono: '999' });
    svc.exigirLibreOMio = jest.fn();
    svc.pedidoDelChat = jest.fn().mockResolvedValue({ pedido: { id: '7' } });
    svc.auditar = jest.fn();
    return { svc: svc as MensajesService, prisma, gateway };
  };
  const usuario: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

  it('anula por cambiarEstado (sin update directo), acepta la solicitud y avisa al cliente', async () => {
    const cambiar = jest.fn().mockResolvedValue({ estado: 'ANULADO' });
    const { svc, prisma, gateway } = armar(cambiar);
    await expect(svc.aplicarCambio('1', usuario, '1.1.1.1')).resolves.toEqual({ ok: true });
    expect(cambiar).toHaveBeenCalledWith(7n, { estado: 'ANULADO', motivo: 'ya no lo quiero' }, usuario, '1.1.1.1');
    expect(prisma.pedido.update).not.toHaveBeenCalled();
    expect(prisma.solicitudCambio.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ACEPTADA' }) }));
    expect(gateway.enviarTexto).toHaveBeenCalled();
  });

  it('pedido pagado sin destino del dinero: el 400 sube y no se acepta ni se avisa', async () => {
    const cambiar = jest.fn().mockRejectedValue(new BadRequestException({ codigo: 'DESTINO_DINERO_REQUERIDO', mensaje: 'elige' }));
    const { svc, prisma, gateway } = armar(cambiar);
    await expect(svc.aplicarCambio('1', usuario)).rejects.toMatchObject({ response: { codigo: 'DESTINO_DINERO_REQUERIDO' } });
    expect(prisma.solicitudCambio.update).not.toHaveBeenCalled();
    expect(gateway.enviarTexto).not.toHaveBeenCalled();
  });

  it('con destino DEVOLVER lo pasa a la anulación', async () => {
    const cambiar = jest.fn().mockResolvedValue({ estado: 'ANULADO' });
    const { svc } = armar(cambiar);
    await svc.aplicarCambio('1', usuario, undefined, { destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 30, devolucionCodigo: 'OP1' });
    expect(cambiar.mock.calls[0][1]).toMatchObject({ estado: 'ANULADO', destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 30, devolucionCodigo: 'OP1' });
  });

  it('con destino REPROGRAMAR el pedido no se anula: no se acepta la cancelación ni se avisa de cancelado', async () => {
    const cambiar = jest.fn().mockResolvedValue({ estado: 'LISTO', reprogramado: true });
    const { svc, prisma, gateway } = armar(cambiar);
    await expect(svc.aplicarCambio('1', usuario, undefined, { destinoDinero: 'REPROGRAMAR' })).resolves.toEqual({ ok: true, reprogramado: true });
    expect(prisma.solicitudCambio.update).not.toHaveBeenCalled();
    expect(gateway.enviarTexto).not.toHaveBeenCalled();
  });
});
