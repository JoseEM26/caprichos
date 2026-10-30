import { puedeCambiarVoucher, puedeSubirVoucher } from '../regla-cambio-voucher';

const base = {
  estado: 'COLA',
  modalidad: 'LLEVAR',
  pago_metodo: 'PLIN',
  pago_estado: 'PENDIENTE',
  pago_coordinado_en: null,
};

describe('regla de cambio de voucher (mientras Caja no apruebe el pago)', () => {
  it('el mozo puede cambiar y quitar con el pedido recién creado en COLA (la cocina no bloquea)', () => {
    expect(puedeCambiarVoucher(base, 'MOZO')).toBe(true);
    expect(puedeSubirVoucher(base, 'MOZO')).toBe(true);
  });

  it('el mozo puede aunque el pedido esté en PREPARANDO o LISTO, mientras el pago esté pendiente', () => {
    expect(puedeCambiarVoucher({ ...base, estado: 'PREPARANDO' }, 'MOZO')).toBe(true);
    expect(puedeCambiarVoucher({ ...base, estado: 'LISTO' }, 'MOZO')).toBe(true);
    expect(puedeCambiarVoucher({ ...base, modalidad: 'MESA', estado: 'PREPARANDO' }, 'MOZO')).toBe(true);
  });

  it('el mozo no puede cuando Caja aprobó, coordinó o cobró el pago', () => {
    expect(puedeCambiarVoucher({ ...base, pago_estado: 'COORDINADO' }, 'MOZO')).toBe(false);
    expect(puedeCambiarVoucher({ ...base, pago_estado: 'PAGADO' }, 'MOZO')).toBe(false);
    expect(puedeCambiarVoucher({ ...base, pago_coordinado_en: new Date() }, 'MOZO')).toBe(false);
    expect(puedeSubirVoucher({ ...base, pago_estado: 'COORDINADO' }, 'MOZO')).toBe(false);
  });

  it('el mozo no puede en un pedido anulado', () => {
    expect(puedeCambiarVoucher({ ...base, estado: 'ANULADO' }, 'MOZO')).toBe(false);
  });

  it('cajero y admin pueden mientras el pago no esté PAGADO, también después de aprobado', () => {
    expect(puedeCambiarVoucher({ ...base, pago_estado: 'COORDINADO' }, 'CAJERO')).toBe(true);
    expect(puedeCambiarVoucher({ ...base, estado: 'LISTO', pago_estado: 'COORDINADO' }, 'ADMIN')).toBe(true);
    expect(puedeCambiarVoucher({ ...base, pago_estado: 'PAGADO' }, 'CAJERO')).toBe(false);
  });
});
