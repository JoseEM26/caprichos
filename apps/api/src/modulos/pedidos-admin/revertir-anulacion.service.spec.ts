jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { RevertirAnulacionService } from './revertir-anulacion.service';

const admin: any = { partyId: 1n, rol: 'ADMIN' };
const supervisor: any = { partyId: 3n, rol: 'SUPERVISOR' };
const cajero: any = { partyId: 2n, rol: 'CAJERO' };
const mozoSupervisor: any = { partyId: 4n, rol: 'MOZO', roles: ['MOZO', 'SUPERVISOR'] };
const anuladoEn = new Date('2026-11-13T15:00:00Z');

function montar(extra: { cobro?: any; devolucion?: any; baja?: number; canje?: any; vigentes?: number; previo?: string | null } = {}) {
  const prisma: any = {
    pedido: {
      findUnique: jest.fn().mockResolvedValue({ id: 10n, codigo: 'CP-W010', estado: 'ANULADO', anulado_en: anuladoEn, anulado_por: 5n, motivo_anulacion: 'x', pago_estado: 'PENDIENTE' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
    },
    pedidoEstadoHistorial: {
      findFirst: jest.fn().mockResolvedValue({ estado_anterior: extra.previo === undefined ? 'PREPARANDO' : extra.previo, en: anuladoEn }),
      create: jest.fn(),
    },
    movimientoPuntos: { findFirst: jest.fn().mockResolvedValue(extra.canje ?? null) },
    cobro: {
      findFirst: jest.fn().mockResolvedValue(extra.cobro ?? null),
      count: jest.fn().mockResolvedValue(extra.vigentes ?? 0),
      update: jest.fn(),
    },
    devolucionPedido: { findUnique: jest.fn().mockResolvedValue(extra.devolucion ?? null) },
    comprobante: { count: jest.fn().mockResolvedValue(extra.baja ?? 0) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const stock: any = { reaplicarPorPedido: jest.fn().mockResolvedValue({}) };
  const puntos: any = { acumularPorPedido: jest.fn().mockResolvedValue({}) };
  const eventos: any = { emitirAdmin: jest.fn() };
  return { prisma, auditoria, stock, puntos, eventos, service: new RevertirAnulacionService(prisma, auditoria, stock, puntos, eventos) };
}
const cobroAnulado = (caja = 'ABIERTA') => ({ id: 5n, caja: { estado: caja } });

describe('RevertirAnulacionService', () => {
  it('solo ADMIN y SUPERVISOR (también como rol extra); Caja recibe 403', async () => {
    const { service, prisma } = montar();
    await expect(service.revertir('10', 'Se anuló por error', cajero)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    await expect(service.revertir('10', 'Se anuló por error', mozoSupervisor)).resolves.toMatchObject({ estado: 'PREPARANDO' });
    await expect(service.revertir('10', 'Se anuló por error', supervisor)).resolves.toBeDefined();
  });

  it('motivo obligatorio (400) y solo pedidos anulados (409)', async () => {
    const { service, prisma } = montar();
    await expect(service.revertir('10', '  ', admin)).rejects.toBeInstanceOf(BadRequestException);
    prisma.pedido.findUnique.mockResolvedValue({ id: 10n, estado: 'LISTO' });
    await expect(service.revertir('10', 'Se anuló por error', admin)).rejects.toBeInstanceOf(ConflictException);
  });

  it('vuelve al estado que tenía antes de anular, reactiva el cobro, rehace stock y puntos, y audita antes/después', async () => {
    const { service, prisma, stock, puntos, auditoria, eventos } = montar({ cobro: cobroAnulado() });
    const r = await service.revertir('10', 'Se anuló por error', admin, '1.1.1.1');
    expect(r).toMatchObject({ estado: 'PREPARANDO', cobroReactivado: true, avisoCobro: null });
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: { id: 10n, estado: 'ANULADO' },
      data: { estado: 'PREPARANDO', anulado_en: null, anulado_por: null, motivo_anulacion: null, anulacion_aprobada_por: null },
    });
    expect(prisma.cobro.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { anulado_en: null, anulado_por: null, motivo_anulacion: null } });
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { pago_estado: 'PAGADO' } });
    expect(prisma.pedidoEstadoHistorial.create.mock.calls[0][0].data).toMatchObject({ estado_anterior: 'ANULADO', estado_nuevo: 'PREPARANDO' });
    expect(stock.reaplicarPorPedido).toHaveBeenCalledWith(10n, anuladoEn, 1n);
    expect(puntos.acumularPorPedido).toHaveBeenCalledWith(10n);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'REVERTIR_ANULACION', motivo: 'Se anuló por error', ip: '1.1.1.1',
      antes: expect.objectContaining({ estado: 'ANULADO' }), despues: expect.objectContaining({ estado: 'PREPARANDO', cobroReactivado: true }),
    }));
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:estado', { id: 10, codigo: 'CP-W010', estado: 'PREPARANDO' });
  });

  it.each([
    ['dinero ya devuelto', { cobro: cobroAnulado(), devolucion: { id: 1n } }, 'ya se devolvió'],
    ['caja del cobro cerrada', { cobro: cobroAnulado('CERRADA') }, 'ya cerró'],
    ['boleta dada de baja', { cobro: cobroAnulado(), baja: 1 }, 'dio de baja'],
  ])('%s: el pedido vuelve pero el cobro NO se reactiva (hay que cobrar de nuevo)', async (_n, extra, texto) => {
    const { service, prisma, puntos, stock } = montar(extra as any);
    const r = await service.revertir('10', 'Se anuló por error', admin);
    expect(r.cobroReactivado).toBe(false);
    expect(r.avisoCobro).toContain(texto);
    expect(prisma.cobro.update).not.toHaveBeenCalled();
    expect(puntos.acumularPorPedido).not.toHaveBeenCalled();
    expect(stock.reaplicarPorPedido).toHaveBeenCalled();
  });

  it('sin cobro (pedido no pagado o pago coordinado): solo cambia el estado', async () => {
    const { service, prisma } = montar();
    const r = await service.revertir('10', 'Se anuló por error', admin);
    expect(r).toMatchObject({ estado: 'PREPARANDO', cobroReactivado: false });
    expect(prisma.cobro.update).not.toHaveBeenCalled();
  });

  it('si la anulación devolvió puntos canjeados: 409 y no se toca el pedido', async () => {
    const { service, prisma } = montar({ canje: { id: 1n } });
    await expect(service.revertir('10', 'Se anuló por error', admin)).rejects.toMatchObject({ response: { codigo: 'PUNTOS_CANJEADOS_DEVUELTOS' } });
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('sin estado previo en el historial: 409', async () => {
    const { service } = montar({ previo: null });
    await expect(service.revertir('10', 'Se anuló por error', admin)).rejects.toMatchObject({ response: { codigo: 'SIN_ESTADO_PREVIO' } });
  });
});
