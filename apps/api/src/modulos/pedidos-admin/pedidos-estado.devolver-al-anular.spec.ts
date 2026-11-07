// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { Logger } from '@nestjs/common';
import { PedidosEstadoService } from './pedidos-estado.service';

describe('PedidosEstadoService.devolverAlAnular (anulación que no traga errores)', () => {
  let prisma: any;
  let auditoria: any;
  let puntos: any;
  let stock: any;
  let service: PedidosEstadoService;
  let logError: jest.SpyInstance;

  beforeEach(() => {
    prisma = { notificacion: { create: jest.fn().mockResolvedValue({}) } };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    puntos = { reversarPorPedido: jest.fn().mockResolvedValue({}) };
    stock = { revertirPorPedido: jest.fn().mockResolvedValue({ ok: true }) };
    service = new PedidosEstadoService(prisma, {} as any, auditoria, undefined, undefined, puntos, stock);
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => logError.mockRestore());

  it('camino feliz: devuelve puntos y stock una vez y no avisa', async () => {
    await service.devolverAlAnular(10n, 'CP-10', 1n);
    expect(puntos.reversarPorPedido).toHaveBeenCalledTimes(1);
    expect(stock.revertirPorPedido).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it('un fallo suelto se reintenta una vez y no deja aviso', async () => {
    stock.revertirPorPedido.mockRejectedValueOnce(new Error('deadlock')).mockResolvedValueOnce({ ok: true });
    await service.devolverAlAnular(10n, 'CP-10', 1n);
    expect(stock.revertirPorPedido).toHaveBeenCalledTimes(2);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('si el stock sigue fallando: log de error, auditoría y aviso a Caja, sin lanzar; los puntos igual se devuelven', async () => {
    stock.revertirPorPedido.mockRejectedValue(new Error('BD caída'));
    await expect(service.devolverAlAnular(10n, 'CP-10', 1n, '1.2.3.4')).resolves.toBeUndefined();

    expect(stock.revertirPorPedido).toHaveBeenCalledTimes(2); // intento + 1 reintento
    expect(puntos.reversarPorPedido).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('ANULACION_DEVOLUCION_FALLIDA'));
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'ANULAR_DEVOLUCION_FALLIDA', entidadId: 10n, despues: { pendiente: 'el stock', detalle: 'BD caída' } }),
    );
    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rol_destino: 'CAJERO',
        mensaje: 'Anulado, pero no se pudo devolver el stock del pedido CP-10: revisa.',
      }),
    });
  });

  it('si los puntos fallan, avisa por los puntos y aun así intenta devolver el stock', async () => {
    puntos.reversarPorPedido.mockRejectedValue(new Error('x'));
    await service.devolverAlAnular(10n, 'CP-10', 1n);
    expect(stock.revertirPorPedido).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create).toHaveBeenCalledTimes(1);
    expect(prisma.notificacion.create.mock.calls[0][0].data.mensaje).toContain('los puntos');
  });

  it('si el aviso y la auditoría también fallan, la anulación no se rompe', async () => {
    stock.revertirPorPedido.mockRejectedValue(new Error('x'));
    auditoria.registrar.mockRejectedValue(new Error('aud'));
    prisma.notificacion.create.mockRejectedValue(new Error('not'));
    await expect(service.devolverAlAnular(10n, 'CP-10', 1n)).resolves.toBeUndefined();
  });

  it('idempotencia: anular dos veces el mismo pedido no devuelve dos veces (la devolución real ya ignora lo revertido)', async () => {
    // revertirPorPedido real filtra movimientos ya revertidos; aquí el doble responde 0 la segunda vez
    stock.revertirPorPedido
      .mockResolvedValueOnce({ ok: true, movimientosRevertidos: 2 })
      .mockResolvedValueOnce({ ok: true, movimientosRevertidos: 0 });
    await service.devolverAlAnular(10n, 'CP-10', 1n);
    await service.devolverAlAnular(10n, 'CP-10', 1n);
    const totales = stock.revertirPorPedido.mock.results.length;
    expect(totales).toBe(2);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});
