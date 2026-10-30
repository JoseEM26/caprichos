import { describe, expect, it } from 'vitest';
import { errorPlan, medioDigitalDelPlan, montoDigitalPlan, nombreMedio, MEDIOS_PLAN } from '../planPago';

describe('plan con Tarjeta', () => {
  it('Tarjeta + Efectivo es válido y no genera voucher', () => {
    const filas = [{ medio: 'TARJETA' as const, monto: '10.00' }, { medio: 'EFECTIVO' as const, monto: '20.00' }];
    expect(errorPlan(30, filas)).toBeNull();
    expect(montoDigitalPlan([{ medio: 'TARJETA', monto: 10 }, { medio: 'EFECTIVO', monto: 20 }])).toBe(0);
    expect(medioDigitalDelPlan([{ medio: 'TARJETA', monto: 10 }])).toBeNull();
    expect(nombreMedio('TARJETA')).toBe('Tarjeta');
    expect(MEDIOS_PLAN).toHaveLength(5);
  });
});
