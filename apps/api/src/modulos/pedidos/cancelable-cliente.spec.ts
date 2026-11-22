import { reglaCancelable, DatosCancelable } from './cancelable-cliente';

const base: DatosCancelable = {
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  cobro_mozo_en: null,
  adelanto_total: 0,
  cobrosVigentes: 0,
  pagosOnlineActivos: 0,
  vouchersVigentes: 0,
  comandasEmpezadas: 0,
};
const razon = (d: Partial<DatosCancelable>) => {
  const r = reglaCancelable({ ...base, ...d });
  return r.cancelable ? 'OK' : r.razon;
};

describe('regla «cancelable por el cliente»', () => {
  it('pendiente sin pagar: sí', () => {
    expect(razon({})).toBe('OK');
    expect(razon({ estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE' })).toBe('OK');
    expect(razon({ estado: 'PROGRAMADO' })).toBe('OK');
  });
  it('pagado, coordinado, cobrado, con cargo en línea o adelanto: no', () => {
    expect(razon({ pago_estado: 'PAGADO' })).toBe('YA_PAGADO');
    expect(razon({ pago_estado: 'COORDINADO' })).toBe('YA_PAGADO');
    expect(razon({ cobrosVigentes: 1 })).toBe('YA_PAGADO');
    expect(razon({ pagosOnlineActivos: 1 })).toBe('YA_PAGADO');
    expect(razon({ adelanto_total: 10 })).toBe('YA_PAGADO');
    expect(razon({ cobro_mozo_en: new Date() })).toBe('YA_PAGADO');
  });
  it('voucher subido y sin validar: no, «pago en revisión»', () => {
    const r = reglaCancelable({ ...base, vouchersVigentes: 1 });
    expect(r.cancelable).toBe(false);
    expect((r as any).razon).toBe('PAGO_EN_REVISION');
    expect((r as any).mensaje).toMatch(/en revisión/);
  });
  it('ya aceptado o en preparación: no', () => {
    expect(razon({ estado: 'PREPARANDO' })).toBe('EN_PREPARACION');
    expect(razon({ estado: 'LISTO' })).toBe('EN_PREPARACION');
    expect(razon({ comandasEmpezadas: 1 })).toBe('EN_PREPARACION');
  });
  it('anulado o entregado: no', () => {
    expect(razon({ estado: 'ANULADO' })).toBe('ANULADO');
    expect(razon({ estado: 'ENTREGADO' })).toBe('FINALIZADO');
  });
});
