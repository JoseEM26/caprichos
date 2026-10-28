import { describe, it, expect } from 'vitest';
import { reglaEnvioGratis, aplicaEnvioGratis, calcularEnvioFinal } from '../utilidades/index.js';

describe('regla de envío gratis', () => {
  it('por defecto: 70 y modo mas_de (estrictamente mayor)', () => {
    const r = reglaEnvioGratis(undefined, undefined);
    expect(r).toEqual({ monto: 70, modo: 'mas_de' });
    expect(aplicaEnvioGratis(70, r)).toBe(false);
    expect(aplicaEnvioGratis(70.01, r)).toBe(true);
  });

  it('modo desde: gratis en el borde exacto', () => {
    const r = reglaEnvioGratis(70, 'desde');
    expect(aplicaEnvioGratis(69.99, r)).toBe(false);
    expect(aplicaEnvioGratis(70, r)).toBe(true);
  });

  it('acepta el monto como texto y descarta valores inválidos', () => {
    expect(reglaEnvioGratis('60', 'mas_de').monto).toBe(60);
    expect(reglaEnvioGratis('', undefined).monto).toBe(70);
    expect(reglaEnvioGratis('abc', undefined).monto).toBe(70);
    expect(reglaEnvioGratis(-5, undefined).monto).toBe(70);
    expect(reglaEnvioGratis(0, undefined).monto).toBe(0);
  });

  it('calcularEnvioFinal da la tarifa de zona fuera de la promo y 0 dentro', () => {
    const r = reglaEnvioGratis(70, 'mas_de');
    expect(calcularEnvioFinal(50, 3, r)).toBe(3);
    expect(calcularEnvioFinal(70, 3, r)).toBe(3);
    expect(calcularEnvioFinal(80, 3, r)).toBe(0);
    expect(calcularEnvioFinal(80, Number('7.00'), reglaEnvioGratis(0, undefined))).toBe(0);
  });
});
