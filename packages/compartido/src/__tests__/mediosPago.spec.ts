import { describe, it, expect } from 'vitest';
import { medioActivo, mediosActivos, normalizarMediosPagoCanal, mediosPagoPorDefecto } from '../mediosPago.js';

describe('Pago en línea (PAGO_EN_LINEA) solo vive en CARTA', () => {
  const todoTrue = { PAGO_EN_LINEA: true, EFECTIVO: true };

  it('normalizar fuerza PAGO_EN_LINEA=false en CAJA, MOZO y BOT aunque venga true', () => {
    const n = normalizarMediosPagoCanal({ CARTA: todoTrue, CAJA: todoTrue, MOZO: todoTrue, BOT: todoTrue });
    expect(n.CARTA.PAGO_EN_LINEA).toBe(true);
    expect(n.CAJA.PAGO_EN_LINEA).toBe(false);
    expect(n.MOZO.PAGO_EN_LINEA).toBe(false);
    expect(n.BOT.PAGO_EN_LINEA).toBe(false);
    expect(n.CAJA.EFECTIVO).toBe(true);
  });

  it('no cambia el valor de fábrica de CARTA (apagado) cuando no viene el parámetro', () => {
    expect(normalizarMediosPagoCanal(undefined).CARTA.PAGO_EN_LINEA).toBe(false);
    expect(mediosPagoPorDefecto().CARTA.PAGO_EN_LINEA).toBe(false);
  });

  it('medioActivo de PAGO_EN_LINEA solo mira CARTA', () => {
    const config = { CARTA: { PAGO_EN_LINEA: true }, CAJA: { PAGO_EN_LINEA: true }, MOZO: { PAGO_EN_LINEA: true }, BOT: { PAGO_EN_LINEA: true } };
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'CARTA')).toBe(true);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'CAJA')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'MOZO')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', 'WHATSAPP')).toBe(false);
    expect(medioActivo(config, 'PAGO_EN_LINEA', null)).toBe(false);
  });

  it('mediosActivos no lista PAGO_EN_LINEA fuera de CARTA', () => {
    const config = { CAJA: { PAGO_EN_LINEA: true }, CARTA: { PAGO_EN_LINEA: true } };
    expect(mediosActivos(config, 'CAJA')).not.toContain('PAGO_EN_LINEA');
    expect(mediosActivos(config, 'CARTA')).toContain('PAGO_EN_LINEA');
  });
});
