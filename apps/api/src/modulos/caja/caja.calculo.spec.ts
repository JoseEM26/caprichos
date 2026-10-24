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

  it('el efectivo del repartidor es lo cobrado en efectivo, o el total si es contra entrega sin cobro', () => {
    expect(
      efectivoDelRepartidor({
        total: 40,
        pago_metodo: 'MIXTO',
        cobro: { anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: 25 }, { medio: 'YAPE', monto: 15 }] },
      }),
    ).toBe(2500);
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'EFECTIVO', cobro: null })).toBe(4000);
    expect(efectivoDelRepartidor({ total: 40, pago_metodo: 'YAPE', cobro: null })).toBe(0);
  });

  it('el esperado excluye el efectivo del repartidor hasta liquidarlo y suma lo que entregó', async () => {
    const cliente: any = {
      pedido: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 7n,
            total: 40,
            pago_metodo: 'EFECTIVO',
            cobro: null,
            repartidor_party_id: 55n,
            repartidor: null,
            codigo: 'CP-7',
            entregado_en: new Date(),
          },
        ]),
      },
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, pedido_id: 1n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(100) }] },
          { id: 2n, pedido_id: 7n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(40) }] },
        ]),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([{ entregado: new Prisma.Decimal(30) }]) },
    };

    const montos = await calcularMontosCaja(cliente, {
      id: 10n,
      fecha: new Date('2026-10-21T00:00:00.000Z'),
      apertura: new Prisma.Decimal(50),
    });

    // 50 de apertura + 100 de venta propia + 30 entregados por el repartidor; los 40 del reparto no cuentan aún
    expect(montos.esperadoEfectivo).toBe(180);
    expect(montos.liquidadoEfectivo).toBe(30);
  });
});
