jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../caja/caja.calculo', () => ({
  ...jest.requireActual('../caja/caja.calculo'),
  bloquearCaja: jest.fn(),
}));
import { PagoPlanService } from '../pedidos/pago-plan.service';
import { bloquearCaja } from '../caja/caja.calculo';
import { MATRIZ } from '../acceso/permisos';
import { AjustarPagoService } from './ajustar-pago.service';

describe('AjustarPagoService (cambiar o agregar medios de pago, siempre y sin aprobación)', () => {
  const cajero: any = { partyId: 2n, rol: 'CAJERO' };
  const supervisor: any = { partyId: 3n, rol: 'SUPERVISOR' };
  const repartidor: any = { partyId: 50n, rol: 'REPARTIDOR' };
  const mozo: any = { partyId: 60n, rol: 'MOZO' };
  let prisma: any;
  let tx: any;
  let auditoria: any;
  let gateway: any;
  let service: AjustarPagoService;
  let pedidoActual: any;

  const pedido = (extra: any = {}) => ({
    id: 7n, codigo: 'CP-007', estado: 'EN_CAMINO', canal: 'CAJA', party_id: null, repartidor_party_id: 50n, pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO', pago_preferido: 'EFECTIVO', total: 41, propina: 0, cobro_mozo_en: null, planPago: [], cobros: [], ...extra,
  });
  const cobro = (extra: any = {}) => ({
    id: 90n, caja_id: 5n, total: 41, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: 41, propina: 0 }], ...extra,
  });

  beforeEach(() => {
    pedidoActual = pedido();
    tx = {
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      pedido: { findUnique: jest.fn(async () => pedidoActual), update: jest.fn() },
      pedidoPagoPlan: { deleteMany: jest.fn(), createMany: jest.fn() },
      cobroPago: { deleteMany: jest.fn(), createMany: jest.fn() },
      comprobante: { count: jest.fn().mockResolvedValue(0) },
      pedidoEstadoHistorial: { create: jest.fn() },
    };
    prisma = {
      pedido: { findUnique: jest.fn(async () => pedidoActual) },
      party: { findMany: jest.fn().mockResolvedValue([{ id: 2n, persona: { nombres: 'Ana', apellidos: 'Paz' } }]) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    (bloquearCaja as jest.Mock).mockResolvedValue({ id: 5n, estado: 'ABIERTA' });
    auditoria = { registrar: jest.fn() };
    gateway = { emitirAdmin: jest.fn() };
    service = new AjustarPagoService(prisma, auditoria, new PagoPlanService(), gateway);
  });

  const yape = [{ medio: 'YAPE', monto: 41 }];

  it('pedido por cobrar: cambia Efectivo → Yape sin código ni aprobación; audita CAMBIO_PAGO, historial y socket', async () => {
    const r = await service.ajustar('7', { plan: yape, motivo: 'pagó con Yape' }, cajero, '1.2.3.4');
    expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'YAPE', pago_preferido: 'YAPE', paga_con: null });
    expect(tx.pedidoPagoPlan.deleteMany).toHaveBeenCalled();
    expect(tx.pedidoPagoPlan.createMany).not.toHaveBeenCalled();
    expect(tx.cobroPago.createMany).not.toHaveBeenCalled();
    expect(tx.pedidoEstadoHistorial.create.mock.calls[0][0].data.motivo).toContain('Efectivo 41.00 → Yape 41.00');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'CAMBIO_PAGO', partyId: 2n, ip: '1.2.3.4', motivo: 'pagó con Yape',
        antes: { plan: 'Efectivo 41.00' },
        despues: expect.objectContaining({ plan: 'Yape 41.00', estado_pedido: 'EN_CAMINO', rol: 'CAJERO', ajuste_posterior_al_cierre: false }),
      }),
    );
    expect(gateway.emitirAdmin).toHaveBeenCalledWith('pedido:pago', expect.objectContaining({ id: '7', cambio: 'pago_ajustado' }));
    expect(r).toMatchObject({ ok: true, mensaje: 'Pago actualizado', modificadoPor: 'Ana Paz' });
  });

  it('agregar otro medio (pago dividido): guarda los renglones, deja el efectivo y valida «paga con»', async () => {
    const mixto = [{ medio: 'YAPE', monto: 20 }, { medio: 'EFECTIVO', monto: 21 }];
    await service.ajustar('7', { plan: mixto, pagaCon: 50 }, cajero);
    expect(tx.pedidoPagoPlan.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'YAPE', paga_con: 50 });
    await expect(service.ajustar('7', { plan: mixto, pagaCon: 10 }, cajero)).rejects.toMatchObject({ response: { codigo: 'PAGA_CON_INVALIDO' } });
  });

  it('suma distinta del total, medio inválido, mismo plan o plan vacío: 400', async () => {
    await expect(service.ajustar('7', { plan: [{ medio: 'YAPE', monto: 30 }] }, cajero)).rejects.toMatchObject({ response: { codigo: 'PLAN_PAGO_NO_CUADRA' } });
    await expect(service.ajustar('7', { plan: [{ medio: 'BITCOIN', monto: 41 }] }, cajero)).rejects.toMatchObject({ response: { codigo: 'PLAN_PAGO_MEDIO_INVALIDO' } });
    await expect(service.ajustar('7', { plan: [{ medio: 'EFECTIVO', monto: 41 }] }, cajero)).rejects.toMatchObject({ response: { codigo: 'SIN_CAMBIO' } });
    await expect(service.ajustar('7', { plan: [] }, cajero)).rejects.toMatchObject({ response: { codigo: 'PLAN_PAGO_INVALIDO' } });
    expect(tx.pedido.update).not.toHaveBeenCalled();
  });

  it('pedido anulado: se rechaza; entregado, en cocina y listo: se permite', async () => {
    pedidoActual = pedido({ estado: 'ANULADO' });
    await expect(service.ajustar('7', { plan: yape }, cajero)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_ANULADO' } });
    for (const estado of ['ENTREGADO', 'COLA', 'LISTO']) {
      pedidoActual = pedido({ estado });
      await expect(service.ajustar('7', { plan: yape }, cajero)).resolves.toMatchObject({ ok: true });
    }
  });

  it('pedido PAGADO con Cobro vigente: reasigna los renglones del MISMO cobro (sin anular ni recobrar), con propina y vuelto', async () => {
    pedidoActual = pedido({ pago_estado: 'PAGADO', estado: 'ENTREGADO', propina: 4, total: 41, cobros: [cobro({ pagos: [{ medio: 'EFECTIVO', monto: 41, propina: 4 }] })] });
    tx.cobro.findFirst.mockResolvedValue({ caja_id: 5n });
    const r = await service.ajustar('7', { plan: [{ medio: 'YAPE', monto: 20 }, { medio: 'EFECTIVO', monto: 25 }], pagaCon: 30 }, supervisor);
    expect(bloquearCaja).toHaveBeenCalledWith(tx, 5n);
    expect(tx.cobroPago.deleteMany).toHaveBeenCalledWith({ where: { cobro_id: 90n } });
    const filas = tx.cobroPago.createMany.mock.calls[0][0].data;
    expect(filas.map((f: any) => f.medio)).toEqual(['YAPE', 'EFECTIVO']);
    // entregado por medio = monto + propina; suma de propinas = 4
    expect(filas.reduce((a: number, f: any) => a + Number(f.monto) + Number(f.propina), 0)).toBeCloseTo(45, 2);
    expect(filas.reduce((a: number, f: any) => a + Number(f.propina), 0)).toBeCloseTo(4, 2);
    expect(Number(filas[1].recibido)).toBe(30);
    expect(Number(filas[1].vuelto)).toBe(5);
    expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ pago_metodo: 'MIXTO' });
    expect(r.cobroActualizado).toBe(true);
    expect(r.antes).toEqual([{ medio: 'EFECTIVO', monto: 45 }]);
  });

  it('con comprobante emitido avisa que conserva el medio original (no se reemite)', async () => {
    pedidoActual = pedido({ pago_estado: 'PAGADO', cobros: [cobro()] });
    tx.cobro.findFirst.mockResolvedValue({ caja_id: 5n });
    tx.comprobante.count.mockResolvedValue(1);
    const r = await service.ajustar('7', { plan: yape }, cajero);
    expect(r.avisos).toContain('El comprobante ya emitido conserva el medio original');
  });

  it('pedido de una caja ya CERRADA: no bloquea, no toca el cobro y queda marcado como ajuste posterior al cierre', async () => {
    pedidoActual = pedido({ pago_estado: 'PAGADO', estado: 'ENTREGADO', cobros: [cobro()] });
    tx.cobro.findFirst.mockResolvedValue({ caja_id: 5n });
    (bloquearCaja as jest.Mock).mockResolvedValue({ id: 5n, estado: 'CERRADA' });
    const r = await service.ajustar('7', { plan: yape }, cajero);
    expect(tx.cobroPago.createMany).not.toHaveBeenCalled();
    expect(r.ajustePosteriorAlCierre).toBe(true);
    expect(r.avisos.join(' ')).toContain('día cerrado');
    expect(auditoria.registrar.mock.calls[0][0].despues).toMatchObject({ ajuste_posterior_al_cierre: true, cobro_actualizado: false });
    expect(tx.pedidoEstadoHistorial.create.mock.calls[0][0].data.motivo).toContain('ajuste posterior al cierre');
  });

  it('cobro por mozo aún sin cobrar: Caja ve el medio nuevo', async () => {
    pedidoActual = pedido({ cobro_mozo_en: new Date() });
    await service.ajustar('7', { plan: yape }, cajero);
    expect(tx.pedido.update.mock.calls[0][0].data).toMatchObject({ cobro_mozo_medio: 'YAPE' });
  });

  it('repartidor: su pedido asignado sí (hecho por el repartidor y aviso en vivo); otro 403', async () => {
    await service.ajustar('7', { plan: yape }, repartidor);
    expect(tx.pedidoEstadoHistorial.create.mock.calls[0][0].data.motivo).toContain('por el repartidor');
    expect(gateway.emitirAdmin).toHaveBeenCalledWith('cambio-cobro:solicitud', expect.objectContaining({ estado: 'APROBADA' }));
    pedidoActual = pedido({ repartidor_party_id: 99n });
    await expect(service.ajustar('7', { plan: yape }, repartidor)).rejects.toMatchObject({ status: 403, response: { codigo: 'PEDIDO_AJENO' } });
  });

  it('mozo: solo los pedidos que él tomó', async () => {
    pedidoActual = pedido({ canal: 'MOZO', party_id: 60n, repartidor_party_id: null });
    await expect(service.ajustar('7', { plan: yape }, mozo)).resolves.toMatchObject({ ok: true });
    pedidoActual = pedido({ canal: 'MOZO', party_id: 61n, repartidor_party_id: null });
    await expect(service.ajustar('7', { plan: yape }, mozo)).rejects.toMatchObject({ status: 403 });
  });

  it('permisos: Caja, Admin, Supervisor, Mozo y Repartidor lo tienen; cocina y almacén no', () => {
    for (const rol of ['ADMIN', 'CAJERO', 'SUPERVISOR', 'MOZO', 'REPARTIDOR']) expect(MATRIZ[rol]).toContain('pedidos/ajustar_pago');
    for (const rol of ['COCINA', 'ALMACEN']) expect(MATRIZ[rol] ?? []).not.toContain('pedidos/ajustar_pago');
  });
});
