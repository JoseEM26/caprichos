jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ReabrirPedidoService } from './reabrir-pedido.service';

const cajero: any = { partyId: 2n, rol: 'CAJERO' };
const admin: any = { partyId: 1n, rol: 'ADMIN' };

describe('ReabrirPedidoService', () => {
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: ReabrirPedidoService;
  const pedido = (extra: any = {}) => ({ id: 10n, codigo: 'CP-W110', estado: 'ENTREGADO', modalidad: 'RECOGER', entregado_en: new Date(), despachado_en: null, repartidor_party_id: null, ruta_reparto_id: null, ...extra });

  beforeEach(() => {
    prisma = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      pedidoEstadoHistorial: { findFirst: jest.fn().mockResolvedValue({ estado_anterior: 'LISTO', en: new Date() }), create: jest.fn() },
      caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }) },
      cobro: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findFirst: jest.fn().mockResolvedValue(null) },
      rutaReparto: { findFirst: jest.fn().mockResolvedValue(null), updateMany: jest.fn() },
      mensajeReparto: { delete: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    auditoria = { registrar: jest.fn() };
    eventos = { emitirAdmin: jest.fn() };
    service = new ReabrirPedidoService(prisma, auditoria, eventos);
  });

  it('ENTREGADO vuelve a LISTO, deja historial, auditoría y evento', async () => {
    const r = await service.reabrir('10', 'Me confundí', cajero, '1.1.1.1');
    expect(r.estado).toBe('LISTO');
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({ where: { id: 10n, estado: 'ENTREGADO' }, data: { estado: 'LISTO', entregado_en: null, llego_en: null } });
    expect(prisma.pedidoEstadoHistorial.create.mock.calls[0][0].data).toMatchObject({ estado_anterior: 'ENTREGADO', estado_nuevo: 'LISTO' });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REABRIR_PEDIDO', motivo: 'Me confundí', ip: '1.1.1.1' }));
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:estado', { id: 10, codigo: 'CP-W110', estado: 'LISTO' });
    // no toca los avisos ya enviados: re-entregar no los duplica (avisar es idempotente por pedido y etapa)
    expect(prisma.mensajeReparto.delete).not.toHaveBeenCalled();
    expect(prisma.mensajeReparto.deleteMany).not.toHaveBeenCalled();
  });

  it('delivery despachado vuelve a EN_CAMINO y reabre su ruta', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'DELIVERY', repartidor_party_id: 7n, ruta_reparto_id: 3n }));
    prisma.pedidoEstadoHistorial.findFirst.mockResolvedValue({ estado_anterior: 'EN_CAMINO', en: new Date() });
    const r = await service.reabrir('10', 'Me confundí', admin);
    expect(r.estado).toBe('EN_CAMINO');
    expect(prisma.rutaReparto.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'EN_CURSO', terminada_en: null } }));
  });

  it.each(['ANULADO', 'RECHAZADO', 'LISTO'])('no reabre un pedido %s', async (estado) => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ estado }));
    await expect(service.reabrir('10', 'Me confundí', cajero)).rejects.toMatchObject({ response: { codigo: 'TRANSICION_INVALIDA' } });
  });

  it.each(['MOZO', 'SUPERVISOR', 'COCINA'])('403 para %s', async (rol) => {
    await expect(service.reabrir('10', 'Me confundí', { partyId: 5n, rol } as any)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('motivo obligatorio', async () => {
    await expect(service.reabrir('10', 'ya', cajero)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fuera de ventana: entregado otro día', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ entregado_en: new Date(Date.now() - 3 * 86400000) }));
    await expect(service.reabrir('10', 'Me confundí', cajero)).rejects.toMatchObject({ response: { codigo: 'FUERA_DE_VENTANA' } });
  });

  it('caja cerrada o cobro en caja cerrada: CIERRE_CERRADO', async () => {
    prisma.caja.findUnique.mockResolvedValue({ estado: 'CERRADA' });
    await expect(service.reabrir('10', 'Me confundí', cajero)).rejects.toMatchObject({ response: { codigo: 'CIERRE_CERRADO' } });
    prisma.caja.findUnique.mockResolvedValue({ estado: 'ABIERTA' });
    prisma.cobro.findMany.mockResolvedValue([{ caja: { estado: 'CERRADA' } }]);
    await expect(service.reabrir('10', 'Me confundí', cajero)).rejects.toBeInstanceOf(ConflictException);
  });

  it('delivery ya liquidado: REPARTO_LIQUIDADO', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'DELIVERY', repartidor_party_id: 7n }));
    prisma.liquidacion.findFirst.mockResolvedValue({ id: 1n });
    await expect(service.reabrir('10', 'Me confundí', cajero)).rejects.toMatchObject({ response: { codigo: 'REPARTO_LIQUIDADO' } });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });
});
