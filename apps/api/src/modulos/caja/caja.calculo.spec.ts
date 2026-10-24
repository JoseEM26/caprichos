import { Prisma } from '@prisma/client';
import {
  aCentimos,
  calcularMontosCaja,
  efectivoDelRepartidor,
  errorCajaAnteriorAbierta,
  esCentimosValidos,
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
});
