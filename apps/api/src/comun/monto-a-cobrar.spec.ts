import { montoACobrar } from './monto-a-cobrar';

describe('montoACobrar', () => {
  it('sin crédito se cobra todo el total', () => {
    expect(montoACobrar({ total: 26 })).toBe(26);
    expect(montoACobrar({ total: '26.00', monto_credito: 0 })).toBe(26);
  });
  it('con crédito del personal + delivery se cobra solo el envío (total - monto_credito), en céntimos exactos', () => {
    expect(montoACobrar({ total: 26, monto_credito: 21 })).toBe(5);
    expect(montoACobrar({ total: '20.30', monto_credito: '17.10' })).toBe(3.2);
  });
  it('si el envío aún no está definido o es gratis no hay nada que cobrar, y nunca es negativo', () => {
    expect(montoACobrar({ total: 21, monto_credito: 21 })).toBe(0);
    expect(montoACobrar({ total: 10, monto_credito: 21 })).toBe(0);
  });
  it('un campo ausente (select sin monto_credito) cuenta como sin crédito', () => {
    expect(montoACobrar({ total: 12.5, monto_credito: undefined })).toBe(12.5);
  });
});
