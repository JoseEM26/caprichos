import { exigirCobroAntesDeEntregar, pedidoDebeEstarCobrado } from './exigir-cobro-antes-de-entregar';

const admin = { rol: 'ADMIN' };
const cajero = { rol: 'CAJERO' };
const base = { total: 40, pago_estado: 'PENDIENTE', pago_metodo: null as string | null };

describe('pedidoDebeEstarCobrado: qué pedidos exigen cobro antes de entregar', () => {
  it.each([
    ['LLEVAR', 'PENDIENTE', null, true],
    ['LLEVAR', 'COORDINADO', 'YAPE', true],
    ['RECOGER', 'PENDIENTE', 'EFECTIVO', true],
    ['LLEVAR', 'PAGADO', 'EFECTIVO', false],
    ['MESA', 'PENDIENTE', null, false],
    ['COMER_LOCAL', 'PENDIENTE', null, false],
    ['DELIVERY', 'PENDIENTE', 'YAPE', true],
    ['DELIVERY', 'COORDINADO', 'PLIN', true],
    ['DELIVERY', 'PENDIENTE', 'TRANSFERENCIA', true],
    ['DELIVERY', 'PENDIENTE', 'TARJETA', false],
    ['DELIVERY', 'PENDIENTE', null, true],
    ['DELIVERY', 'PENDIENTE', 'EFECTIVO', false],
    ['DELIVERY', 'PAGADO', 'YAPE', false],
  ])('%s %s con %s -> exige cobro: %s', (modalidad, pago_estado, pago_metodo, esperado) => {
    expect(pedidoDebeEstarCobrado({ ...base, modalidad, pago_estado, pago_metodo })).toBe(esperado);
  });

  it('crédito del personal + delivery: el envío por Yape exige cobro; sin envío por cobrar (gratis o por confirmar) no', () => {
    const credito = { ...base, total: 26, modalidad: 'DELIVERY', pago_metodo: 'YAPE', monto_credito: 21 };
    expect(pedidoDebeEstarCobrado(credito)).toBe(true);
    expect(pedidoDebeEstarCobrado({ ...credito, total: 21 })).toBe(false);
    expect(pedidoDebeEstarCobrado({ ...credito, pago_estado: 'PAGADO' })).toBe(false);
  });

  it('pedido del personal: no exige cobro (se carga a su crédito)', () => {
    expect(pedidoDebeEstarCobrado({ ...base, modalidad: 'LLEVAR', es_personal: true })).toBe(false);
    expect(pedidoDebeEstarCobrado({ ...base, modalidad: 'DELIVERY', pago_metodo: 'YAPE', es_personal: true })).toBe(false);
  });

  it('delivery con tarjeta en el plan: POS en la puerta, no exige', () => {
    expect(pedidoDebeEstarCobrado({ ...base, modalidad: 'DELIVERY', pago_metodo: 'YAPE', planPago: [{ medio: 'TARJETA', monto: 40 }] })).toBe(false);
  });

  it('delivery con plan mixto: con renglón de efectivo no exige; solo digital sí', () => {
    const mixto = [{ medio: 'EFECTIVO', monto: 15 }, { medio: 'YAPE', monto: 25 }];
    expect(pedidoDebeEstarCobrado({ ...base, modalidad: 'DELIVERY', pago_metodo: 'YAPE', planPago: mixto })).toBe(false);
    expect(pedidoDebeEstarCobrado({ ...base, modalidad: 'DELIVERY', pago_metodo: 'YAPE', planPago: [{ medio: 'YAPE', monto: 40 }] })).toBe(true);
  });
});

describe('exigirCobroAntesDeEntregar', () => {
  const prisma: any = { pedidoPagoPlan: { findMany: jest.fn().mockResolvedValue([]) } };
  const llevar = { ...base, id: 1n, modalidad: 'LLEVAR' };

  it('pedido que no exige cobro: no hace nada', async () => {
    expect(await exigirCobroAntesDeEntregar(prisma, { ...llevar, pago_estado: 'PAGADO' }, cajero)).toBe(false);
    expect(await exigirCobroAntesDeEntregar(prisma, { ...llevar, modalidad: 'MESA' }, cajero)).toBe(false);
  });

  it('delivery digital sin plan cargado: lo consulta; con efectivo en el plan no exige', async () => {
    prisma.pedidoPagoPlan.findMany.mockResolvedValueOnce([{ medio: 'EFECTIVO', monto: 40 }]);
    const d = { ...base, id: 2n, modalidad: 'DELIVERY', pago_metodo: 'YAPE' };
    expect(await exigirCobroAntesDeEntregar(prisma, d, cajero)).toBe(false);
  });

  it('sin forzar: 409 COBRO_PENDIENTE; puedeForzar solo para el ADMIN', async () => {
    const e1: any = await exigirCobroAntesDeEntregar(prisma, llevar, cajero).catch((e) => e);
    expect(e1.getStatus()).toBe(409);
    expect(e1.getResponse()).toMatchObject({ codigo: 'COBRO_PENDIENTE', puedeForzar: false });
    expect(e1.getResponse().mensaje).not.toContain('administrador');
    const e2: any = await exigirCobroAntesDeEntregar(prisma, llevar, admin).catch((e) => e);
    expect(e2.getResponse()).toMatchObject({ codigo: 'COBRO_PENDIENTE', puedeForzar: true });
  });

  it('no-ADMIN que fuerza: 403 FORZAR_SOLO_ADMIN', async () => {
    const e: any = await exigirCobroAntesDeEntregar(prisma, llevar, cajero, { forzar: true, motivo: 'Motivo suficientemente largo' }).catch((x) => x);
    expect(e.getStatus()).toBe(403);
    expect(e.getResponse().codigo).toBe('FORZAR_SOLO_ADMIN');
  });

  it('ADMIN sin motivo, corto o larguísimo: 400 MOTIVO_REQUERIDO', async () => {
    for (const motivo of [undefined, '', ' corto ', 'x'.repeat(301)]) {
      const e: any = await exigirCobroAntesDeEntregar(prisma, llevar, admin, { forzar: true, motivo }).catch((x) => x);
      expect(e.getStatus()).toBe(400);
      expect(e.getResponse().codigo).toBe('MOTIVO_REQUERIDO');
    }
  });

  it('ADMIN con motivo de 10 o más caracteres: pasa y devuelve true (forzado)', async () => {
    expect(await exigirCobroAntesDeEntregar(prisma, llevar, admin, { forzar: true, motivo: 'Cliente VIP pagó' })).toBe(true);
  });

  it('usuario con ADMIN entre varios roles también puede forzar', async () => {
    expect(await exigirCobroAntesDeEntregar(prisma, llevar, { rol: 'CAJERO', roles: ['CAJERO', 'ADMIN'] }, { forzar: true, motivo: 'Motivo de prueba ok' })).toBe(true);
  });
});
