import { describe, it, expect } from 'vitest';
import { horaAmPm, textoEnvioGratisHasta, envioGratisPromoAplica } from '../envioGratis';

describe('envío gratis (texto y regla de la carta)', () => {
  it('convierte la hora de fin a 12 horas', () => {
    expect(horaAmPm('18:00')).toBe('6:00 pm');
    expect(horaAmPm('09:30')).toBe('9:30 am');
    expect(horaAmPm(null)).toBeNull();
  });

  it('dice hasta qué hora rige, o solo «Envío gratis» si no hay fin', () => {
    expect(textoEnvioGratisHasta('18:00')).toBe('Envío gratis hasta las 6:00 pm');
    expect(textoEnvioGratisHasta(null)).toBe('Envío gratis');
  });

  it('aplica sin compra mínima y con mínimo solo si el subtotal lo alcanza (igual que el servidor)', () => {
    expect(envioGratisPromoAplica({ nombre: 'x', hasta: null, compraMinima: null }, 3)).toBe(true);
    expect(envioGratisPromoAplica({ nombre: 'x', hasta: null, compraMinima: 50 }, 49.99)).toBe(false);
    expect(envioGratisPromoAplica({ nombre: 'x', hasta: null, compraMinima: 50 }, 50)).toBe(true);
    expect(envioGratisPromoAplica(null, 100)).toBe(false);
  });
});
