import { Prisma } from '@prisma/client';
import {
  aCentimos,
  calcularMontosCaja,
  efectivoDelRepartidor,
  errorCajaAnteriorAbierta,
  esCentimosValidos,
  exigirCajaAbiertaHoy,
} from './caja.calculo';
import { calcularTotalConteo } from '../cierre/cierre.util';

describe('caja.calculo', () => {
  it('suma en céntimos: 0,1 + 0,2 es exactamente 0,30 (sin errores de float)', () => {
    expect(aCentimos(0.1) + aCentimos(0.2)).toBe(aCentimos(0.3));
    expect(calcularTotalConteo({ '0.1': 3, '0.2': 1 })).toBe(0.5);
  });

  it('si una caja de otro día sigue abierta, el error lo dice con su fecha; si no hay ninguna, no hay error', async () => {
    const tx: any = { caja: { findFirst: jest.fn().mockResolvedValue({ fecha: new Date('2026-10-22T00:00:00.000Z') }) } };
    await expect(errorCajaAnteriorAbierta(tx)).resolves.toMatchObject({
      response: { codigo: 'CAJA_ANTERIOR_SIN_CERRAR', mensaje: expect.stringContaining('22/10/2026') },
    });
    tx.caja.findFirst.mockResolvedValue(null);
    await expect(errorCajaAnteriorAbierta(tx)).resolves.toBeNull();
  });

  it('rechaza montos con más de dos decimales', () => {
    expect(esCentimosValidos(10.1)).toBe(true);
    expect(esCentimosValidos(10.005)).toBe(false);
  });

  it('el efectivo del repartidor es solo el contra entrega: un pedido cobrado en caja no es suyo', () => {
    // cobrado en caja (con cobro vigente): entra en la caja por su medio, no se liquida aparte
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'EFECTIVO', cobros: [{ anulado_en: null }] })).toBe(0);
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [{ anulado_en: null }] })).toBe(0);
    // crédito del personal + delivery: el repartidor solo trae el envío
    expect(efectivoDelRepartidor({ total: 26, monto_credito: 21, pago_metodo: 'EFECTIVO', cobros: [] })).toBe(500);
    // contra entrega en efectivo: lo trae el repartidor y lo liquida
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'EFECTIVO', cobros: [] })).toBe(4000);
    // cobro anulado: vuelve a ser contra entrega
    expect(
      efectivoDelRepartidor({ total: 40, pago_metodo: 'EFECTIVO', cobros: [{ anulado_en: new Date() }] }),
    ).toBe(4000);
    // anulado y vuelto a cobrar: lo que cuenta es el cobro vigente, no el anulado que se conserva
    expect(
      efectivoDelRepartidor({
        total: 40,
        pago_metodo: 'EFECTIVO',
        cobros: [{ anulado_en: new Date() }, { anulado_en: null }],
      }),
    ).toBe(0);
    // contra entrega con Yape: no hay efectivo que liquidar
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [] })).toBe(0);
  });

  it('cambio de cobro en la puerta: el efectivo del repartidor sigue el plan final aprobado', () => {
    // efectivo → Yape: desaparece el efectivo por rendir
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [] })).toBe(0);
    // Yape → efectivo: se suma
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'EFECTIVO', cobros: [] })).toBe(4000);
    // mixto efectivo + Yape: solo el renglón de efectivo
    const plan = [{ medio: 'EFECTIVO', monto: 15 }, { medio: 'YAPE', monto: 25 }];
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [], planPago: plan })).toBe(1500);
    // todo digital con plan: nada que rendir
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [], planPago: [{ medio: 'YAPE', monto: 25 }, { medio: 'PLIN', monto: 15 }] })).toBe(0);
    // ya cobrado en caja: no es del repartidor
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [{ anulado_en: null }], planPago: plan })).toBe(0);
  });

  it('Yape parcial S/ 38 + S/ 2 en efectivo contraentrega: el repartidor rinde solo los S/ 2', () => {
    const plan = [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }];
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobros: [], planPago: plan })).toBe(200);
  });

  it('delivery cobrado en caja cuenta en la caja y el contra entrega solo al liquidarse, sin duplicar', async () => {
    const cliente: any = {
      pedido: {
        // repartido hoy: CP-8 es contra entrega en efectivo (sin cobro); CP-7 ya está cobrado en caja
        findMany: jest.fn().mockResolvedValue([
          {
            id: 8n,
            total: 25,
            pago_metodo: 'EFECTIVO',
            cobro: null,
            repartidor_party_id: 55n,
            repartidor: null,
            codigo: 'CP-8',
            entregado_en: new Date(),
          },
        ]),
      },
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, pedido_id: 1n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(100) }] },
          { id: 2n, pedido_id: 7n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(40) }] },
          { id: 3n, pedido_id: 9n, anulado_en: null, pagos: [{ medio: 'YAPE', monto: new Prisma.Decimal(20) }] },
        ]),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([{ entregado: new Prisma.Decimal(25) }]) },
    };

    const montos = await calcularMontosCaja(cliente, {
      id: 10n,
      fecha: new Date('2026-10-21T00:00:00.000Z'),
      apertura: new Prisma.Decimal(50),
    });

    // 50 apertura + 100 venta propia + 40 del delivery cobrado en caja + 25 entregados al liquidar
    expect(montos.esperadoEfectivo).toBe(215);
    expect(montos.liquidadoEfectivo).toBe(25);
    // el Yape cobrado en caja cuenta por su medio
    expect(montos.sistemaYape).toBe(20);
  });

  it('propina: suma al efectivo esperado y a su medio digital; la devolución del día la resta (sin doble conteo)', async () => {
    const cliente: any = {
      pedido: {
        // pedido devuelto hoy: su propina en efectivo (5) sale de la caja; la digital (2) sale del día
        findMany: jest.fn().mockResolvedValue([{ cobros: [{ pagos: [{ medio: 'EFECTIVO', propina: new Prisma.Decimal(5) }, { medio: 'YAPE', propina: new Prisma.Decimal(0) }] }] }]),
      },
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            anulado_en: null,
            pagos: [
              { medio: 'EFECTIVO', monto: new Prisma.Decimal(30), propina: new Prisma.Decimal(5) },
              { medio: 'YAPE', monto: new Prisma.Decimal(20), propina: new Prisma.Decimal(2) },
            ],
          },
        ]),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const montos = await calcularMontosCaja(cliente, {
      id: 10n,
      fecha: new Date('2026-11-06T00:00:00.000Z'),
      apertura: new Prisma.Decimal(50),
    });

    // venta en efectivo 30; propina efectiva 5 cobrada y devuelta hoy => 0 neta
    expect(montos.ventasEfectivo).toBe(30);
    expect(montos.propinasEfectivo).toBe(0);
    expect(montos.esperadoEfectivo).toBe(80);
    // Yape incluye su propina cobrada (22); la digital neta es 2 - 0 (la devolución digital no traía propina)
    expect(montos.sistemaYape).toBe(22);
    expect(montos.propinasDigitales).toBe(2);
    // la ventana de devoluciones es el día Lima de la caja (05:00Z a 05:00Z del día siguiente)
    expect(cliente.pedido.findMany.mock.calls[0][0].where.devolucion.is.creado_en.gte.toISOString()).toBe('2026-11-06T05:00:00.000Z');
  });

  it('propina en pago dividido con los 5 medios: cada medio recibe su parte y el total de propinas cuadra', async () => {
    const m = (monto: number, propina: number, medio: string) => ({ medio, monto: new Prisma.Decimal(monto), propina: new Prisma.Decimal(propina) });
    const cliente: any = {
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, anulado_en: null, pagos: [m(10, 1, 'EFECTIVO'), m(10, 1, 'YAPE'), m(10, 1, 'PLIN'), m(10, 1, 'TARJETA'), m(10, 1, 'TRANSFERENCIA')] },
        ]),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const montos = await calcularMontosCaja(cliente, { id: 10n, fecha: new Date('2026-11-06T00:00:00.000Z'), apertura: new Prisma.Decimal(0) });
    expect(montos.propinasEfectivo).toBe(1);
    expect(montos.propinasDigitales).toBe(4);
    expect([montos.sistemaYape, montos.sistemaPlin, montos.sistemaTransferencia, montos.sistemaTarjeta]).toEqual([11, 11, 11, 11]);
    expect(montos.esperadoEfectivo).toBe(11);
  });

  it('el cobro anulado (conservado, RNF-CAP-014) no cuenta en lo esperado: solo los vigentes de la caja', async () => {
    const cobros = [
      { id: 1n, caja_id: 10n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(30) }] },
      {
        id: 2n,
        caja_id: 10n,
        anulado_en: new Date('2026-10-21T15:00:00.000Z'),
        pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(999) }],
      },
    ];
    const cliente: any = {
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      // el mock aplica el filtro real: solo devuelve los cobros de la caja que cumplen anulado_en
      cobro: {
        findMany: jest.fn(async ({ where }: any) =>
          cobros.filter((c) => c.caja_id === where.caja_id && c.anulado_en === where.anulado_en),
        ),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const montos = await calcularMontosCaja(cliente, {
      id: 10n,
      fecha: new Date('2026-10-21T00:00:00.000Z'),
      apertura: new Prisma.Decimal(50),
    });

    expect(cliente.cobro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ anulado_en: null }) }),
    );
    expect(montos.esperadoEfectivo).toBe(80);
    expect(montos.ventasEfectivo).toBe(30);
  });

  describe('exigirCajaAbiertaHoy (aprobar y cobrar pagos)', () => {
    const cajaDb = (hoy: any, otraAbierta: any = null) => ({
      caja: {
        findUnique: jest.fn().mockResolvedValue(hoy),
        findFirst: jest.fn().mockResolvedValue(otraAbierta),
      },
    });

    it('caja de hoy abierta -> pasa', async () => {
      await expect(exigirCajaAbiertaHoy(cajaDb({ estado: 'ABIERTA' }) as any)).resolves.toBeUndefined();
    });

    it('sin caja de hoy -> CAJA_CERRADA con el mensaje de pagos', async () => {
      await expect(exigirCajaAbiertaHoy(cajaDb(null) as any)).rejects.toMatchObject({
        response: { codigo: 'CAJA_CERRADA', mensaje: expect.stringContaining('Abre caja para cobrar y aprobar pagos') },
      });
    });

    it('caja de hoy ya cerrada -> CAJA_CERRADA', async () => {
      await expect(exigirCajaAbiertaHoy(cajaDb({ estado: 'CERRADA' }) as any)).rejects.toMatchObject({
        response: { codigo: 'CAJA_CERRADA' },
      });
    });

    it('una caja de otro día sigue abierta -> CAJA_ANTERIOR_SIN_CERRAR (mismo criterio que cobrar)', async () => {
      await expect(
        exigirCajaAbiertaHoy(cajaDb(null, { fecha: new Date('2026-10-22T00:00:00.000Z') }) as any),
      ).rejects.toMatchObject({ response: { codigo: 'CAJA_ANTERIOR_SIN_CERRAR' } });
    });
  });
});
