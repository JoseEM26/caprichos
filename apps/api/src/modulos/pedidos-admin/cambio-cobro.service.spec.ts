jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PagoPlanService } from '../pedidos/pago-plan.service';
import { CambioCobroService, mismoPlan, planActualDelPedido } from './cambio-cobro.service';

describe('CambioCobroService (cambio de forma de pago en la puerta)', () => {
  const repartidor: any = { partyId: 50n, rol: 'REPARTIDOR' };
  const caja: any = { partyId: 2n, rol: 'CAJERO' };
  const captura: any = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' };
  let prisma: any;
  let tx: any;
  let vouchers: any;
  let auditoria: any;
  let gateway: any;
  let service: CambioCobroService;
  let ajustar: any;

  const pedido = (extra: any = {}) => ({
    id: 7n, codigo: 'CP-W007', modalidad: 'DELIVERY', estado: 'EN_CAMINO', repartidor_party_id: 50n,
    pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', total: 40, propina: 0,
    planPago: [], estado_x: 1, ...extra,
  });
  const solicitud = (extra: any = {}) => ({
    id: 3n, pedido_id: 7n, solicitado_por_party_id: 50n, solicitado_en: new Date(), estado: 'PENDIENTE',
    plan_original: [{ medio: 'EFECTIVO', monto: 40 }], plan_solicitado: [{ medio: 'YAPE', monto: 40 }],
    paga_con: null, voucher_ids: [11n], motivo: null, resuelto_por_party_id: null, resuelto_en: null, ...extra,
  });
  const plan = (p: any[]) => JSON.stringify(p);

  beforeEach(() => {
    tx = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()), update: jest.fn() },
      pedidoPagoPlan: { deleteMany: jest.fn(), createMany: jest.fn() },
      voucherPago: { updateMany: jest.fn() },
      pedidoEstadoHistorial: { create: jest.fn() },
      solicitudCambioCobro: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(solicitud({ estado: 'APROBADA' })),
      },
    };
    prisma = {
      ...tx,
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) },
      solicitudCambioCobro: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(solicitud()),
        create: jest.fn().mockResolvedValue(solicitud({ estado: 'APROBADA' })),
        updateMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      voucherPago: { updateMany: jest.fn() },
      pedidoEstadoHistorial: { create: jest.fn() },
      party: { findMany: jest.fn().mockResolvedValue([{ id: 50n, persona: { nombres: 'Luis', apellidos: 'Ruiz' } }]) },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    vouchers = { subirYProcesar: jest.fn().mockResolvedValue({ id: '11', legible: true }) };
    auditoria = { registrar: jest.fn() };
    gateway = { emitirAdmin: jest.fn() };
    ajustar = { ajustar: jest.fn().mockResolvedValue({ antes: [{ medio: 'EFECTIVO', monto: 40 }], modificadoPor: 'Luis Ruiz' }) };
    service = new CambioCobroService(prisma, auditoria, vouchers, new PagoPlanService(), ajustar, gateway);
  });

  describe('solicitar', () => {
    it('solo el repartidor dueño: otro recibe 403 y no se crea nada', async () => {
      prisma.pedido.findUnique.mockResolvedValue(pedido({ repartidor_party_id: 99n }));
      await expect(service.solicitar('7', { plan: plan([{ medio: 'YAPE', monto: 40 }]) }, { YAPE: captura }, repartidor)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.solicitudCambioCobro.create).not.toHaveBeenCalled();
    });

    // ANTES: LISTO/ENTREGADO/ANULADO daban 409 ESTADO_INVALIDO; ahora el estado lo decide AjustarPagoService (solo ANULADO se rechaza allí)
    it('se aplica de inmediato por AjustarPagoService (sin aprobar) y queda la fila APROBADA para Caja', async () => {
      const r = await service.solicitar('7', { plan: plan([{ medio: 'YAPE', monto: 40 }]) }, { YAPE: captura }, repartidor);
      expect(vouchers.subirYProcesar).toHaveBeenCalledWith(
        captura,
        expect.objectContaining({ medio: 'YAPE', origen: 'REPARTIDOR', planEsperado: [{ medio: 'YAPE', monto: 40 }] }),
        repartidor,
        undefined,
      );
      expect(ajustar.ajustar).toHaveBeenCalledWith('7', { plan: [{ medio: 'YAPE', monto: 40 }], pagaCon: undefined }, repartidor, undefined, 'REPARTIDOR');
      expect(prisma.solicitudCambioCobro.create.mock.calls[0][0].data).toMatchObject({
        estado: 'APROBADA', plan_original: [{ medio: 'EFECTIVO', monto: 40 }], plan_solicitado: [{ medio: 'YAPE', monto: 40 }], voucher_ids: [11n], resuelto_por_party_id: 50n,
      });
      expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'CAMBIO_COBRO_APLICADO', rol_destino: 'CAJERO' }) });
      expect(r.estado).toBe('APROBADA');
    });

    it('las solicitudes PENDIENTES antiguas del pedido se cierran al aplicar el cambio nuevo', async () => {
      await service.solicitar('7', { plan: plan([{ medio: 'TARJETA', monto: 40 }]) }, {}, repartidor);
      expect(prisma.solicitudCambioCobro.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido_id: 7n, estado: 'PENDIENTE' }, data: expect.objectContaining({ estado: 'RECHAZADA' }) }),
      );
    });

    it('la captura de cada medio digital es opcional: solo sube la que haya', async () => {
      const mixto = plan([{ medio: 'EFECTIVO', monto: 10 }, { medio: 'YAPE', monto: 20 }, { medio: 'PLIN', monto: 10 }]);
      await expect(service.solicitar('7', { plan: mixto }, { YAPE: captura }, repartidor)).resolves.toMatchObject({ estado: 'APROBADA' });
      expect(vouchers.subirYProcesar).toHaveBeenCalledTimes(1);
      expect(vouchers.subirYProcesar.mock.calls[0][1]).toMatchObject({ medio: 'YAPE' });
      vouchers.subirYProcesar.mockClear();
      await service.solicitar('7', { plan: plan([{ medio: 'YAPE', monto: 40 }]) }, {}, repartidor);
      expect(vouchers.subirYProcesar).not.toHaveBeenCalled();
      expect(prisma.solicitudCambioCobro.create.mock.calls.at(-1)[0].data.voucher_ids).toEqual([]);
    });

    it('el plan debe cuadrar con el total (no se llega a ajustar)', async () => {
      await expect(service.solicitar('7', { plan: plan([{ medio: 'TARJETA', monto: 30 }]) }, {}, repartidor)).rejects.toMatchObject({ response: { codigo: 'PLAN_PAGO_NO_CUADRA' } });
      expect(ajustar.ajustar).not.toHaveBeenCalled();
    });

    it('una captura ilegible no cuenta: se retira y el cambio sigue sin ella', async () => {
      vouchers.subirYProcesar.mockResolvedValue({ id: '11', legible: false });
      await expect(service.solicitar('7', { plan: plan([{ medio: 'YAPE', monto: 40 }]) }, { YAPE: captura }, repartidor)).resolves.toMatchObject({ estado: 'APROBADA' });
      expect(prisma.voucherPago.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 11n }, data: { retirado: true } });
      expect(prisma.solicitudCambioCobro.create.mock.calls[0][0].data.voucher_ids).toEqual([]);
    });
  });

  describe('resolver', () => {
    it('aprobar con efectivo → Yape: aplica el plan nuevo, pago_metodo YAPE (sale el efectivo por rendir) y valida la captura', async () => {
      await service.resolver('7', '3', { accion: 'APROBAR' }, caja);
      expect(tx.pedidoPagoPlan.deleteMany).toHaveBeenCalledWith({ where: { pedido_id: 7n } });
      expect(tx.pedidoPagoPlan.createMany).not.toHaveBeenCalled(); // medio único: sin renglones de plan
      expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'YAPE', pago_preferido: 'YAPE', paga_con: null });
      expect(tx.voucherPago.updateMany.mock.calls[0][0].data).toMatchObject({ revisado_por: 2n });
      expect(tx.solicitudCambioCobro.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'APROBADA', resuelto_por_party_id: 2n });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'APROBAR_CAMBIO_COBRO', partyId: 2n }));
      expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'CAMBIO_COBRO_RESUELTO', party_destino: 50n }) });
      expect(gateway.emitirAdmin).toHaveBeenCalledWith('cambio-cobro:solicitud', expect.objectContaining({ estado: 'APROBADA', repartidorPartyId: '50' }));
    });

    it('aprobar un mixto efectivo+Yape guarda el plan y deja el efectivo a cobrar; Yape → efectivo vuelve a sumarlo', async () => {
      prisma.solicitudCambioCobro.findUnique.mockResolvedValue(
        solicitud({ plan_solicitado: [{ medio: 'EFECTIVO', monto: 15 }, { medio: 'YAPE', monto: 25 }], paga_con: 20 }),
      );
      await service.resolver('7', '3', { accion: 'APROBAR' }, caja);
      expect(tx.pedidoPagoPlan.createMany.mock.calls[0][0].data).toEqual([
        expect.objectContaining({ medio: 'EFECTIVO', orden: 0 }),
        expect.objectContaining({ medio: 'YAPE', orden: 1 }),
      ]);
      expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'YAPE', paga_con: 20 });

      tx.pedido.update.mockClear();
      prisma.solicitudCambioCobro.findUnique.mockResolvedValue(
        solicitud({ plan_original: [{ medio: 'YAPE', monto: 40 }], plan_solicitado: [{ medio: 'EFECTIVO', monto: 40 }], voucher_ids: [], paga_con: 50 }),
      );
      await service.resolver('7', '3', { accion: 'APROBAR' }, caja);
      expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'EFECTIVO', paga_con: 50 });
    });

    it('rechazar conserva el pedido original y retira las capturas del intento', async () => {
      tx.solicitudCambioCobro.findUniqueOrThrow.mockResolvedValue(solicitud({ estado: 'RECHAZADA' }));
      await service.resolver('7', '3', { accion: 'RECHAZAR', motivo: 'El Yape no llegó' }, caja);
      expect(tx.pedido.update).not.toHaveBeenCalled();
      expect(tx.pedidoPagoPlan.deleteMany).not.toHaveBeenCalled();
      expect(tx.voucherPago.updateMany.mock.calls[0][0].data).toMatchObject({ retirado: true });
      expect(tx.solicitudCambioCobro.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'RECHAZADA', motivo: 'El Yape no llegó' });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'RECHAZAR_CAMBIO_COBRO', motivo: 'El Yape no llegó' }));
    });

    it('autorizar sin validar exige motivo, aplica el plan y deja la captura sin validar', async () => {
      await expect(service.resolver('7', '3', { accion: 'AUTORIZAR_SIN_VALIDAR', motivo: 'ya' }, caja)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
      await service.resolver('7', '3', { accion: 'AUTORIZAR_SIN_VALIDAR', motivo: 'La app de Yape no abre' }, caja);
      expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'YAPE' });
      expect(tx.voucherPago.updateMany).not.toHaveBeenCalled();
      expect(tx.solicitudCambioCobro.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'AUTORIZADA_SIN_VALIDAR', motivo: 'La app de Yape no abre' });
    });

    it('una solicitud ya resuelta, de otro pedido o una acción desconocida se rechazan', async () => {
      prisma.solicitudCambioCobro.findUnique.mockResolvedValue(solicitud({ estado: 'APROBADA' }));
      await expect(service.resolver('7', '3', { accion: 'APROBAR' }, caja)).rejects.toMatchObject({ response: { codigo: 'SOLICITUD_NO_VIGENTE' } });
      prisma.solicitudCambioCobro.findUnique.mockResolvedValue(solicitud({ pedido_id: 8n }));
      await expect(service.resolver('7', '3', { accion: 'APROBAR' }, caja)).rejects.toMatchObject({ response: { codigo: 'SOLICITUD_NO_ENCONTRADA' } });
      await expect(service.resolver('7', '3', { accion: 'BORRAR' }, caja)).rejects.toMatchObject({ response: { codigo: 'ACCION_INVALIDA' } });
    });

    it('dos Cajas a la vez: la segunda ve la fila ya resuelta y no aplica el plan dos veces', async () => {
      tx.solicitudCambioCobro.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.resolver('7', '3', { accion: 'APROBAR' }, caja)).rejects.toMatchObject({ response: { codigo: 'SOLICITUD_NO_VIGENTE' } });
      expect(tx.pedido.update).not.toHaveBeenCalled();
    });

    it('no aplica el cambio si el pedido ya fue pagado o anulado', async () => {
      tx.pedido.findUnique.mockResolvedValue(pedido({ pago_estado: 'PAGADO' }));
      await expect(service.resolver('7', '3', { accion: 'APROBAR' }, caja)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_NO_MODIFICABLE' } });
    });
  });

  describe('vigente', () => {
    it('el repartidor solo ve las solicitudes de sus pedidos', async () => {
      prisma.pedido.findUnique.mockResolvedValue({ repartidor_party_id: 99n });
      await expect(service.vigente('7', repartidor)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('utilitarios', () => {
    it('planActualDelPedido: renglones del plan o el medio único por el total cobrable', () => {
      expect(planActualDelPedido({ planPago: [], pago_metodo: 'YAPE', total: 40, propina: 2 })).toEqual([{ medio: 'YAPE', monto: 42 }]);
      expect(planActualDelPedido({ planPago: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(10) }], pago_metodo: 'YAPE', total: 40 })).toEqual([{ medio: 'EFECTIVO', monto: 10 }]);
    });
    it('mismoPlan ignora el orden', () => {
      expect(mismoPlan([{ medio: 'A', monto: 1 }, { medio: 'B', monto: 2 }], [{ medio: 'B', monto: 2 }, { medio: 'A', monto: 1 }])).toBe(true);
    });
  });
});
