import { calcularMontosCaja } from '../caja/caja.calculo';
import { alertasCobroCulqi, armarCulqiCierre, devueltoCulqiDelDia, operacionesCulqiDeCaja, resumirComisionCulqi } from './culqi-cierre.util';

/**
 * Escenario numérico del día (caja abierta con S/ 100 de apertura):
 *  - 2 cobros en EFECTIVO: S/ 30 y S/ 20 (efectivo esperado = 100 + 50 = 150)
 *  - 3 cobros Culqi: tarjeta S/ 52.50 (CP-1), Yape S/ 30 (CP-2, devolución parcial de S/ 10 por Culqi), tarjeta S/ 40 (CP-3)
 * Nada de Culqi entra al efectivo esperado; el bloque Culqi va aparte.
 */
const fecha = new Date('2026-11-17T00:00:00Z');
const cajaDia = { id: 1n, fecha, apertura: 100 };
const dentroDelDia = '2026-11-17T18:00:00Z';

function clienteCaja() {
  const cobrosVigentes = [
    { id: 1n, pedido_id: 1n, en: fecha, anulado_en: null, pedido: { codigo: 'CP-E1' }, pagos: [{ medio: 'EFECTIVO', monto: 30, propina: 0, origen: 'MANUAL' }] },
    { id: 2n, pedido_id: 2n, en: fecha, anulado_en: null, pedido: { codigo: 'CP-E2' }, pagos: [{ medio: 'EFECTIVO', monto: 20, propina: 0, origen: 'MANUAL' }] },
    { id: 3n, pedido_id: 3n, en: fecha, anulado_en: null, pedido: { codigo: 'CP-1' }, pagos: [{ medio: 'TARJETA', monto: 52.5, propina: 0, origen: 'CULQI', comision_pasarela: 2.83, comision_detalle: { fijo: 0.3, variable: 2.1, igv: 0.43, fuente: 'CULQI', neto_depositado: 0 } }] },
    { id: 4n, pedido_id: 4n, en: fecha, anulado_en: null, pedido: { codigo: 'CP-2' }, pagos: [{ medio: 'YAPE', monto: 30, propina: 0, origen: 'CULQI', comision_pasarela: null, comision_detalle: null }] },
    { id: 5n, pedido_id: 5n, en: fecha, anulado_en: null, pedido: { codigo: 'CP-3' }, pagos: [{ medio: 'TARJETA', monto: 40, propina: 0, origen: 'CULQI', comision_pasarela: 1.77, comision_detalle: { fijo: 0.3, variable: 1.2, igv: 0.27, fuente: 'ESTIMADA', neto_depositado: 0 } }] },
  ];
  const intentos = [
    { pedido_id: 3n, culqi_cargo_id: 'chr_1', medio: 'TARJETA', monto_centimos: 5250, devoluciones: [] },
    { pedido_id: 4n, culqi_cargo_id: 'chr_2', medio: 'YAPE', monto_centimos: 3000, devoluciones: [{ id: 'rf_1', monto_centimos: 1000, en: dentroDelDia, medio: 'CULQI' }] },
    { pedido_id: 5n, culqi_cargo_id: 'chr_3', medio: 'TARJETA', monto_centimos: 4000, devoluciones: [] },
  ];
  return {
    cobro: {
      // Vigentes (anulado_en null) para la caja; los anulados no aparecen en este escenario
      findMany: jest.fn(async (args: any) => (args.where.anulado_en?.not !== undefined ? [] : cobrosVigentes)),
    },
    pedido: { findMany: jest.fn(async () => []) },
    movimientoCaja: { findMany: jest.fn(async () => []) },
    liquidacion: { findMany: jest.fn(async () => []) },
    pagoOnlineIntento: { findMany: jest.fn(async () => intentos) },
  };
}

describe('Cuadre de caja con Culqi: escenario numérico del día', () => {
  it('efectivo esperado = apertura + efectivo; el Culqi no entra; bloque Culqi y total exactos', async () => {
    const db: any = clienteCaja();
    const montos = await calcularMontosCaja(db, cajaDia);
    expect(montos.esperadoEfectivo).toBe(150);
    expect(montos.ventasEfectivo).toBe(50);
    expect(montos.sistemaTarjeta).toBe(0);
    expect(montos.sistemaYape).toBe(0);
    expect(montos.sistemaTarjetaCulqi).toBe(92.5);
    expect(montos.sistemaYapeCulqi).toBe(30);

    const devueltoCulqi = await devueltoCulqiDelDia(db, new Date('2026-11-17T05:00:00Z'), new Date('2026-11-18T05:00:00Z'));
    expect(devueltoCulqi).toEqual({ yape: 10, tarjeta: 0 });

    const culqi = armarCulqiCierre({ yape: montos.sistemaYapeCulqi, tarjeta: montos.sistemaTarjetaCulqi }, devueltoCulqi);
    expect(culqi).toMatchObject({ cobradoYape: 30, cobradoTarjeta: 92.5, devueltoYape: 10, devueltoTarjeta: 0, yape: 20, tarjeta: 92.5, total: 112.5 });
  });

  it('operaciones y comisión: bruto = cobrado - devuelto Culqi, neto = bruto - comisiones; la de «por confirmar» no suma', async () => {
    const db: any = clienteCaja();
    const ops = await operacionesCulqiDeCaja(db, 1n);
    expect(ops).toHaveLength(3);
    expect(ops[1]).toMatchObject({ pedidoCodigo: 'CP-2', estado: 'DEVUELTO_CULQI', devueltoCulqi: 10, monto: 30 });
    const r = resumirComisionCulqi(ops);
    expect(r).toEqual({ pagos: 3, porConfirmar: 1, estimadas: 1, bruto: 112.5, devueltoCulqi: 10, total: 4.6, fijo: 0.6, variable: 3.3, igv: 0.7, neto: 107.9 });
  });

  it('devolución total por Culqi sale del bruto; lo devuelto por Yape del local NO (sigue en Culqi)', () => {
    const r = resumirComisionCulqi([
      { monto: 30, estado: 'DEVUELTO_CULQI', devueltoCulqi: 30, comision: 1, comisionDetalle: null },
      { monto: 25, estado: 'DEVUELTO_FUERA', devueltoCulqi: 0, comision: 0.5, comisionDetalle: null },
    ]);
    expect(r.bruto).toBe(25);
    expect(r.devueltoCulqi).toBe(30);
    // Neto = bruto (25) - comisiones de TODAS las operaciones (30 de Culqi también paga su comisión: 1 + 0.5)
    expect(r.neto).toBe(23.5);
  });

  it('alertas: cobro aprobado sin registrar, tardío (pedido cambió de medio) y devolver (pedido anulado)', async () => {
    const db: any = {
      pagoOnlineIntento: {
        findMany: jest.fn().mockResolvedValue([
          { pedido_id: 7n, monto_centimos: 5000, cobro_error: 'PEDIDO_YA_NO_EN_LINEA: el pedido cambió de medio de pago antes de aprobarse el cargo', pedido: { codigo: 'CP-7' } },
          { pedido_id: 8n, monto_centimos: 1500, cobro_error: 'PEDIDO_ANULADO_DEVOLVER: el cliente pagó con el pedido ya anulado', pedido: { codigo: 'CP-8' } },
          { pedido_id: 9n, monto_centimos: 2000, cobro_error: null, pedido: { codigo: 'CP-9' } },
        ]),
      },
    };
    const al = await alertasCobroCulqi(db);
    expect(al.map((a) => [a.pedidoCodigo, a.tipo, a.monto])).toEqual([['CP-7', 'TARDIO', 50], ['CP-8', 'DEVOLVER', 15], ['CP-9', 'SIN_REGISTRAR', 20]]);
    expect(db.pagoOnlineIntento.findMany.mock.calls[0][0].where).toEqual({ estado: 'APROBADO', cobrado_en: null });
  });
});
