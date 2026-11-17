import { operacionesCulqiDeCaja, resumirComisionCulqi } from './culqi-cierre.util';

const det = (fijo: number, variable: number, igv: number, fuente = 'CULQI') => ({ fijo, variable, igv, neto_depositado: 0, fuente });

describe('Comisión de la pasarela en el cuadre', () => {
  it('suma la comisión aparte: neto = cobrado vigente - comisión; la devuelta sigue costando; sin dato = por confirmar', () => {
    const r = resumirComisionCulqi([
      { monto: 52.5, estado: 'COBRADO', comision: 2.83, comisionDetalle: det(0.3, 2.1, 0.43) },
      { monto: 30, estado: 'DEVUELTO_CULQI', comision: 1.77, comisionDetalle: det(0.3, 1.2, 0.27, 'ESTIMADA') },
      { monto: 20, estado: 'COBRADO', comision: null },
    ]);
    expect(r).toEqual({ pagos: 3, porConfirmar: 1, estimadas: 1, bruto: 72.5, devueltoCulqi: 30, total: 4.6, fijo: 0.6, variable: 3.3, igv: 0.7, neto: 67.9 });
  });

  it('las operaciones traen su comisión del cobro_pago, sin tocar el monto cobrado', async () => {
    const db: any = {
      cobro: {
        findMany: jest.fn().mockResolvedValue([
          { pedido_id: 7n, en: new Date(), anulado_en: null, pedido: { codigo: 'P-7' }, pagos: [{ origen: 'CULQI', medio: 'TARJETA', monto: 52.5, propina: 0, comision_pasarela: 2.83, comision_detalle: det(0.3, 2.1, 0.43) }] },
        ]),
      },
      pagoOnlineIntento: { findMany: jest.fn().mockResolvedValue([{ pedido_id: 7n, culqi_cargo_id: 'chr_1', devoluciones: [] }]) },
    };
    const ops = await operacionesCulqiDeCaja(db, 1n);
    expect(ops[0]).toMatchObject({ monto: 52.5, comision: 2.83, estado: 'COBRADO' });
  });
});
