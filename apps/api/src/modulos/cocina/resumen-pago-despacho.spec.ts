import { resumenPagoDespacho } from './resumen-pago-despacho';

const base = { total: 40, descuento: 0, propina: 0, pago_estado: 'PENDIENTE' };

describe('resumenPagoDespacho', () => {
  it('efectivo con paga_con mayor: lleva vuelto', () => {
    const r = resumenPagoDespacho({ ...base, pago_metodo: 'EFECTIVO', paga_con: 50 });
    expect(r.llevaVuelto).toBe(true);
    expect(r.vuelto).toBe(10);
    expect(r.estado).toBe('POR_COBRAR');
  });
  it('efectivo exacto: sin vuelto', () => {
    const r = resumenPagoDespacho({ ...base, pago_metodo: 'EFECTIVO', paga_con: 40 });
    expect(r.llevaVuelto).toBe(false);
    expect(r.vuelto).toBe(0);
  });
  it('efectivo sin dato de con cuánto paga: no se sabe', () => {
    const r = resumenPagoDespacho({ ...base, pago_metodo: 'EFECTIVO' });
    expect(r.llevaVuelto).toBeNull();
  });
  it('pago dividido: el vuelto cuenta solo el renglón de efectivo', () => {
    const r = resumenPagoDespacho({
      ...base,
      paga_con: 10,
      planPago: [
        { medio: 'YAPE', monto: 30, orden: 0 },
        { medio: 'EFECTIVO', monto: 10, orden: 1 },
      ],
    });
    expect(r.medios).toHaveLength(2);
    expect(r.efectivo).toBe(10);
    expect(r.llevaVuelto).toBe(false);
  });
  it('sin efectivo: sin vuelto; cobrado por mozo usa lo recibido', () => {
    expect(resumenPagoDespacho({ ...base, pago_metodo: 'YAPE' }).llevaVuelto).toBe(false);
    const r = resumenPagoDespacho({ ...base, pago_metodo: 'EFECTIVO', cobro_mozo_en: new Date(), cobro_mozo_recibido: 100 });
    expect(r.estado).toBe('COBRADO_MOZO');
    expect(r.vuelto).toBe(60);
  });
});
