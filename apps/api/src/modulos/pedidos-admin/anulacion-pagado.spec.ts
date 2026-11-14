jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
// El egreso real bloquea la caja con SQL: aquí solo importa cuánto efectivo sale
jest.mock('../caja/caja.calculo', () => ({
  ...jest.requireActual('../caja/caja.calculo'),
  registrarEgresoDevolucionCajaHoy: jest.fn(async (_tx: any, monto: number) => ({ id: 900n, monto })),
}));
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { registrarEgresoDevolucionCajaHoy } from '../caja/caja.calculo';
import { AnulacionPagadoService } from './anulacion-pagado.service';
import { PedidosEstadoService } from './pedidos-estado.service';

const admin: any = { partyId: 1n, rol: 'ADMIN' };
const cajero: any = { partyId: 2n, rol: 'CAJERO' };
const pedidoBase = (extra: any = {}) => ({
  id: 50n, codigo: 'CP-W050', modalidad: 'DELIVERY', estado: 'LISTO', motivo_falla: 'NO_CONTESTA', repartidor_party_id: null,
  pago_estado: 'PAGADO', total: new Prisma.Decimal(40), envio: new Prisma.Decimal(5), ...extra,
});

function montar(opts: { cobro?: any } = {}) {
  const egreso = registrarEgresoDevolucionCajaHoy as jest.Mock;
  egreso.mockClear();
  const prisma: any = {
    cobro: { findMany: jest.fn().mockResolvedValue(opts.cobro ? [{ credito_personal: false }] : []), findFirst: jest.fn().mockResolvedValue(opts.cobro ?? null) },
    caja: { findUnique: jest.fn().mockResolvedValue({ estado: 'ABIERTA' }) },
    devolucionPedido: {
      create: jest.fn().mockResolvedValue({ id: 70n, movimiento_caja_id: null }),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    movimientoCaja: { delete: jest.fn().mockResolvedValue({}) },
    incidenteEntrega: { findFirst: jest.fn().mockResolvedValue({ id: 9n }), update: jest.fn() },
    pedido: { update: jest.fn() },
    mensajeReparto: { updateMany: jest.fn() },
    pedidoEstadoHistorial: { create: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const cobros: any = {
    anularCobro: jest.fn().mockResolvedValue({ comprobante_baja: { estado: 'ACEPTADA' } }),
    anularCobroCajaCerrada: jest.fn().mockResolvedValue({}),
  };
  const avisos: any = { avisar: jest.fn(), despertar: jest.fn() };
  const eventos: any = { emitirAdmin: jest.fn() };
  const service = new AnulacionPagadoService(prisma, auditoria, cobros, avisos, eventos);
  return { prisma, auditoria, cobros, avisos, egreso, service };
}
const cobroEfectivo = (cajaEstado = 'ABIERTA', monto = 40) => ({
  id: 5n, caja: { estado: cajaEstado }, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(monto), propina: new Prisma.Decimal(0) }],
});

describe('Anular un pedido pagado: qué pasa con el dinero', () => {
  it('sin elegir destino: 400 DESTINO_DINERO_REQUERIDO y no toca nada', async () => {
    const { service, prisma, cobros } = montar({ cobro: cobroEfectivo() });
    await expect(service.resolver(pedidoBase(), { estado: 'ANULADO' } as any, 'Cliente no recibió', admin)).rejects.toMatchObject({
      response: { codigo: 'DESTINO_DINERO_REQUERIDO' },
    });
    expect(cobros.anularCobro).not.toHaveBeenCalled();
    expect(prisma.devolucionPedido.create).not.toHaveBeenCalled();
  });

  it('detecta pagado por cobro vigente o por pago PAGADO/COORDINADO; el crédito del personal no es dinero', async () => {
    const { service, prisma } = montar();
    expect(await service.estaPagado({ id: 1n, pago_estado: 'PENDIENTE' })).toBe(false);
    expect(await service.estaPagado({ id: 1n, pago_estado: 'COORDINADO' })).toBe(true);
    prisma.cobro.findMany.mockResolvedValue([{ credito_personal: true }]);
    expect(await service.estaPagado({ id: 1n, pago_estado: 'PAGADO' })).toBe(false);
    prisma.cobro.findMany.mockResolvedValue([{ credito_personal: false }]);
    expect(await service.estaPagado({ id: 1n, pago_estado: 'PENDIENTE' })).toBe(true);
  });

  it('devolver en efectivo un cobro de la caja abierta: devolución + cobro anulado; el efectivo del cobro ya sale del arqueo (sin egreso doble)', async () => {
    const { service, prisma, cobros, egreso, auditoria } = montar({ cobro: cobroEfectivo() });
    const r = await service.resolver(pedidoBase(), { estado: 'ANULADO', destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', admin);
    expect(r).toBe('DEVUELTO');
    expect(cobros.anularCobro).toHaveBeenCalledWith(5n, { motivo: 'Pedido anulado: Cliente no recibió' }, admin, undefined);
    expect(egreso).not.toHaveBeenCalled();
    expect(prisma.devolucionPedido.create.mock.calls[0][0].data).toMatchObject({ pedido_id: 50n, medio: 'EFECTIVO', codigo_operacion: null });
    expect(prisma.devolucionPedido.update).toHaveBeenCalledWith({ where: { id: 70n }, data: { comprobante_baja_estado: 'ACEPTADA' } });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DEVOLUCION_AL_ANULAR' }));
  });

  it('devolver en efectivo un pago coordinado (sin cobro): crea el egreso de caja de hoy por el monto', async () => {
    const { service, egreso, cobros, prisma } = montar();
    await service.resolver(pedidoBase({ pago_estado: 'COORDINADO' }), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 35 } as any, 'Cliente no recibió', admin);
    expect(egreso).toHaveBeenCalledWith(expect.anything(), 35, expect.stringContaining('CP-W050'));
    expect(cobros.anularCobro).not.toHaveBeenCalled();
    expect(prisma.devolucionPedido.create.mock.calls[0][0].data.monto_devuelto).toBe(35);
  });

  it('devolver en efectivo un cobro pagado con Yape: el efectivo que sale no estaba en el arqueo, hay egreso', async () => {
    const yape = { id: 6n, caja: { estado: 'ABIERTA' }, pagos: [{ medio: 'YAPE', monto: new Prisma.Decimal(40), propina: new Prisma.Decimal(0) }] };
    const { service, egreso } = montar({ cobro: yape });
    await service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', admin);
    expect(egreso).toHaveBeenCalledWith(expect.anything(), 40, expect.any(String));
  });

  it('devolver por Yape exige código de operación y no crea egreso', async () => {
    const { service, egreso } = montar({ cobro: cobroEfectivo() });
    await expect(service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 40 } as any, 'Cliente no recibió', admin)).rejects.toMatchObject({
      response: { codigo: 'CODIGO_OPERACION_REQUERIDO' },
    });
    await service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 40, devolucionCodigo: 'OP123' } as any, 'Cliente no recibió', admin);
    expect(egreso).not.toHaveBeenCalled();
  });

  it('monto mayor a lo pagado o medio faltante: 400', async () => {
    const { service } = montar();
    await expect(service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 41 } as any, 'motivo largo', admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMonto: 10 } as any, 'motivo largo', admin)).rejects.toMatchObject({ response: { codigo: 'MEDIO_DEVOLUCION_REQUERIDO' } });
  });

  it('cobro de caja cerrada: solo el ADMIN (por anularCobroCajaCerrada); Caja recibe 409 y no se registra nada', async () => {
    const { service, prisma, cobros } = montar({ cobro: cobroEfectivo('CERRADA') });
    await expect(service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', cajero)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.devolucionPedido.create).not.toHaveBeenCalled();
    await service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', admin);
    expect(cobros.anularCobroCajaCerrada).toHaveBeenCalled();
    expect(cobros.anularCobro).not.toHaveBeenCalled();
  });

  it('si anular el cobro falla se deshace la devolución (no queda dinero devuelto sin cobro anulado)', async () => {
    const { service, prisma, cobros } = montar({ cobro: cobroEfectivo() });
    cobros.anularCobro.mockRejectedValue(new Error('boom'));
    await expect(service.resolver(pedidoBase(), { destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40 } as any, 'Cliente no recibió', admin)).rejects.toThrow('boom');
    expect(prisma.devolucionPedido.delete).toHaveBeenCalledWith({ where: { id: 70n } });
  });

  it('REPROGRAMAR: no anula; el delivery vuelve a «Para elegir» (sin falla ni repartidor), cierra el incidente, avisa y audita con el pago intacto', async () => {
    const { service, prisma, avisos, auditoria, cobros } = montar({ cobro: cobroEfectivo() });
    const r = await service.resolver(pedidoBase(), { destinoDinero: 'REPROGRAMAR' } as any, 'Cliente pide otra hora', admin);
    expect(r).toBe('REPROGRAMADO');
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 50n }, data: { motivo_falla: null } });
    expect(prisma.incidenteEntrega.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { cierre: 'REPROGRAMADO', cerrado_por: 1n } });
    expect(avisos.avisar).toHaveBeenCalledWith(50n, 'REENVIADO', {}, expect.anything());
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REPROGRAMAR_EN_VEZ_DE_ANULAR' }));
    expect(cobros.anularCobro).not.toHaveBeenCalled();
    expect(prisma.devolucionPedido.create).not.toHaveBeenCalled();
  });

  it('REPROGRAMAR de un pedido que no volvió del reparto: 409 (se elige devolver)', async () => {
    const { service } = montar();
    await expect(service.resolver(pedidoBase({ motivo_falla: null }), { destinoDinero: 'REPROGRAMAR' } as any, 'motivo largo', admin)).rejects.toMatchObject({ response: { codigo: 'SIN_REPROGRAMACION' } });
  });
});

describe('PedidosEstadoService.cambiarEstado ANULADO con pedido pagado', () => {
  const montarEstado = (pedido: any, cobro: any = null) => {
    const { prisma, service: anulacion } = montar({ cobro });
    prisma.pedido.findUnique = jest.fn().mockResolvedValue(pedido);
    prisma.pedido.update = jest.fn().mockResolvedValue({ ...pedido, estado: 'ANULADO' });
    prisma.pedidoEstadoHistorial.create = jest.fn();
    prisma.comandaArea = { findMany: jest.fn().mockResolvedValue([]) };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    const servicio = new PedidosEstadoService(prisma, {} as any, auditoria, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, anulacion);
    return { prisma, servicio };
  };

  it('pagado sin elegir destino: 400 y el pedido NO se anula', async () => {
    const { prisma, servicio } = montarEstado(pedidoBase({ motivo_falla: null }));
    await expect(servicio.cambiarEstado(50n, { estado: 'ANULADO', motivo: 'Cliente no recibió' }, admin)).rejects.toMatchObject({ response: { codigo: 'DESTINO_DINERO_REQUERIDO' } });
    expect(prisma.pedido.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO' }) }));
  });

  it('pagado con REPROGRAMAR: devuelve el pedido sin anular', async () => {
    const { prisma, servicio } = montarEstado(pedidoBase());
    const r: any = await servicio.cambiarEstado(50n, { estado: 'ANULADO', motivo: 'Cliente pide otra hora', destinoDinero: 'REPROGRAMAR' }, admin);
    expect(r.reprogramado).toBe(true);
    expect(prisma.pedido.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO' }) }));
  });

  it('no pagado: se anula como siempre, sin pedir destino', async () => {
    const { prisma, servicio } = montarEstado(pedidoBase({ pago_estado: 'PENDIENTE' }));
    const r: any = await servicio.cambiarEstado(50n, { estado: 'ANULADO', motivo: 'Cliente desistió' }, admin);
    expect(r.estado).toBe('ANULADO');
    expect(prisma.pedido.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO' }) }));
  });
});
