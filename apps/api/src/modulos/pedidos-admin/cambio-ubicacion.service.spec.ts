jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CambioUbicacionService } from './cambio-ubicacion.service';

describe('CambioUbicacionService', () => {
  const caja: any = { partyId: 2n, rol: 'CAJERO' };
  let prisma: any;
  let zonas: any;
  let auditoria: any;
  let ventana: any;
  let service: CambioUbicacionService;

  const pedido = (extra: any = {}) => ({
    id: 7n,
    codigo: 'CP-W007',
    modalidad: 'DELIVERY',
    estado: 'PREPARANDO',
    canal: 'CARTA',
    subtotal: 40,
    descuento: 0,
    envio: null,
    total: 40,
    pago_estado: 'PENDIENTE',
    entrega_lat: null,
    entrega_lng: null,
    entrega_direccion: null,
    entrega_referencia: null,
    zona_id: null,
    cliente_telefono: null,
    cupon_id: null,
    cupon_emitido_id: null,
    creado_en: new Date('2026-11-06T15:00:00Z'),
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue(pedido()),
        update: jest.fn().mockResolvedValue({}),
      },
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      pedidoCambioUbicacion: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 99n }),
        update: jest.fn().mockResolvedValue({ id: 99n }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pedidoPagoPlan: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 70 }) },
      oferta: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      caja: { findUnique: jest.fn().mockResolvedValue({ id: 1n, estado: 'ABIERTA' }) },
      movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 5n }) },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    zonas = { detectar: jest.fn().mockResolvedValue({ zonaId: 3n, codigo: 'Z3', tarifa: 6 }) };
    auditoria = { registrar: jest.fn() };
    ventana = {
      esVentanaAbierta: jest.fn().mockResolvedValue(true),
      enviarMensajeNegocio: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };
    service = new CambioUbicacionService(prisma, zonas, auditoria, ventana, undefined);
  });

  const punto = { lat: -12.05, lng: -76.97 };

  it('no cambia un pedido ENTREGADO ni ANULADO', async () => {
    for (const estado of ['ENTREGADO', 'ANULADO']) {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ estado }));
      await expect(service.cambiarPorCaja('7', punto, caja)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_CERRADO' } });
    }
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('pedido no encontrado: 404', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(service.cambiarPorCaja('7', punto, caja)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cambio directo de Caja cancela la propuesta pendiente del repartidor (misma transacción)', async () => {
    prisma.pedidoCambioUbicacion.findMany.mockResolvedValueOnce([{ id: 55n }]);
    await service.cambiarPorCaja('7', punto, caja);
    expect(prisma.pedidoCambioUbicacion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pedido_id: 7n, estado: 'PROPUESTA' } }),
    );
    expect(prisma.pedidoCambioUbicacion.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [55n] }, estado: 'PROPUESTA' },
      data: expect.objectContaining({
        estado: 'CANCELADA',
        motivo: 'Caja cambió la ubicación directamente',
      }),
    });
  });

  it('sin propuesta pendiente no toca nada de propuestas', async () => {
    await service.cambiarPorCaja('7', punto, caja);
    expect(prisma.pedidoCambioUbicacion.updateMany).not.toHaveBeenCalled();
  });

  it('pedido sin pagar: el total cambia con el envío nuevo y no deja ajuste', async () => {
    const r = await service.cambiarPorCaja('7', punto, caja);
    expect(r).toMatchObject({ zona: 'Z3', envioAnterior: 0, envioNuevo: 6, diferencia: 6, totalNuevo: 46, ajuste: null, avisoCliente: 'SIN_WHATSAPP' });
    expect(Number(prisma.pedido.update.mock.calls[0][0].data.total)).toBe(46);
    expect(prisma.pedidoCambioUbicacion.create.mock.calls[0][0].data).toMatchObject({ origen: 'CAJA', estado: 'APROBADA', ajuste_estado: null });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CAMBIAR_UBICACION' }), prisma);
  });

  it('pagado y envío mayor: saldo por cobrar de la diferencia', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ pago_estado: 'PAGADO', total: 40 }));
    prisma.cobro.findFirst.mockResolvedValue({ total: 40 });
    const r = await service.cambiarPorCaja('7', punto, caja);
    expect(r.ajuste).toEqual({ tipo: 'SALDO', monto: 6 });
    expect(prisma.pedidoCambioUbicacion.create.mock.calls[0][0].data).toMatchObject({ ajuste_tipo: 'SALDO', ajuste_monto: 6, ajuste_estado: 'PENDIENTE' });
  });

  it('pagado y envío menor: devolución pendiente, el cobro original no se toca', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ pago_estado: 'PAGADO', envio: 6, total: 46 }));
    prisma.cobro.findFirst.mockResolvedValue({ total: 46 });
    zonas.detectar.mockResolvedValue({ zonaId: 4n, codigo: 'Z0', tarifa: 0 });
    const r = await service.cambiarPorCaja('7', punto, caja);
    expect(r).toMatchObject({ envioNuevo: 0, totalNuevo: 40, ajuste: { tipo: 'DEVOLUCION', monto: 6 } });
    expect(prisma.cobro.findFirst).toHaveBeenCalled();
  });

  it('con un saldo o devolución sin resolver no admite otro cambio', async () => {
    prisma.pedidoCambioUbicacion.findFirst.mockResolvedValue({ id: 1n });
    await expect(service.cambiarPorCaja('7', punto, caja)).rejects.toMatchObject({ response: { codigo: 'AJUSTE_PENDIENTE' } });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('fuera de cobertura no guarda nada', async () => {
    zonas.detectar.mockResolvedValue(null);
    await expect(service.cambiarPorCaja('7', punto, caja)).rejects.toMatchObject({ response: { codigo: 'FUERA_DE_COBERTURA' } });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('avisa al cliente solo si cambia el envío y dentro de la ventana de 24 h', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ cliente_telefono: '999111222' }));
    const r = await service.cambiarPorCaja('7', punto, caja);
    expect(r.avisoCliente).toBe('ENVIADO');
    expect(ventana.enviarMensajeNegocio).toHaveBeenCalledWith('999111222', { textoLibre: expect.stringContaining('CP-W007') });

    ventana.esVentanaAbierta.mockResolvedValue(false);
    const cerrada = await service.cambiarPorCaja('7', punto, caja);
    expect(cerrada.avisoCliente).toBe('NO_ENVIADO_VENTANA');
    expect(ventana.enviarMensajeNegocio).toHaveBeenCalledTimes(1);
  });

  it('sin cambio de envío no avisa al cliente', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ cliente_telefono: '999111222', envio: 6, total: 46 }));
    zonas.detectar.mockResolvedValue({ zonaId: 3n, codigo: 'Z3', tarifa: 6 });
    const r = await service.cambiarPorCaja('7', punto, caja);
    expect(r.diferencia).toBe(0);
    expect(r.avisoCliente).toBeNull();
    expect(ventana.esVentanaAbierta).not.toHaveBeenCalled();
  });

  it('previsualizar no escribe nada', async () => {
    const r = await service.previsualizar('7', punto.lat, punto.lng);
    expect(r).toMatchObject({ zona: 'Z3', envioNuevo: 6, totalNuevo: 46 });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
    expect(prisma.pedidoCambioUbicacion.create).not.toHaveBeenCalled();
  });

  describe('liquidar ajuste', () => {
    const fila = (extra: any = {}) => ({ id: 99n, pedido_id: 7n, ajuste_tipo: 'SALDO', ajuste_estado: 'PENDIENTE', ajuste_monto: 6, ...extra });

    beforeEach(() => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ codigo: 'CP-W007' }));
      prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue(fila());
    });

    it('saldo cobrado en efectivo entra a la caja como INGRESO', async () => {
      const r = await service.liquidarAjuste('7', '99', { medio: 'EFECTIVO' }, caja);
      expect(r).toMatchObject({ ajusteEstado: 'COBRADO', monto: 6 });
      expect(prisma.movimientoCaja.create.mock.calls[0][0].data).toMatchObject({ tipo: 'INGRESO', caja_id: 1n });
      expect(prisma.pedidoCambioUbicacion.updateMany.mock.calls[0][0].data).toMatchObject({ ajuste_estado: 'COBRADO', ajuste_movimiento_caja_id: 5n });
    });

    it('devolución en efectivo sale de la caja como EGRESO', async () => {
      prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue(fila({ ajuste_tipo: 'DEVOLUCION' }));
      const r = await service.liquidarAjuste('7', '99', { medio: 'EFECTIVO' }, caja);
      expect(r.ajusteEstado).toBe('DEVUELTO');
      expect(prisma.movimientoCaja.create.mock.calls[0][0].data).toMatchObject({ tipo: 'EGRESO' });
    });

    it('digital exige código de operación y no toca la caja', async () => {
      await expect(service.liquidarAjuste('7', '99', { medio: 'YAPE' }, caja)).rejects.toMatchObject({ response: { codigo: 'CODIGO_OPERACION_REQUERIDO' } });
      const r = await service.liquidarAjuste('7', '99', { medio: 'YAPE', codigoOperacion: '123456' }, caja);
      expect(r.ajusteEstado).toBe('COBRADO');
      expect(prisma.movimientoCaja.create).not.toHaveBeenCalled();
      expect(prisma.pedidoCambioUbicacion.updateMany.mock.calls[0][0].data).toMatchObject({ ajuste_codigo_operacion: '123456', ajuste_medio: 'YAPE' });
    });

    it('efectivo con la caja cerrada: 409 y no se resuelve', async () => {
      prisma.caja.findUnique.mockResolvedValue({ id: 1n, estado: 'CERRADA' });
      await expect(service.liquidarAjuste('7', '99', { medio: 'EFECTIVO' }, caja)).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
      expect(prisma.pedidoCambioUbicacion.updateMany).not.toHaveBeenCalled();
    });

    it('un ajuste ya resuelto no se vuelve a cobrar', async () => {
      prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue(fila({ ajuste_estado: 'COBRADO' }));
      await expect(service.liquidarAjuste('7', '99', { medio: 'YAPE', codigoOperacion: '1' }, caja)).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
