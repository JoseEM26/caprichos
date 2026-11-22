import { aclaracionPuntos } from './puntos-elegibles.util';

describe('aclaracionPuntos (invitación del bot a la carta)', () => {
  it('sigue los interruptores «combos/ofertas suman puntos»', () => {
    expect(aclaracionPuntos({ combos: false, ofertas: false })).toBe(' (en productos sin promo)');
    expect(aclaracionPuntos({})).toBe(' (en productos sin promo)');
    expect(aclaracionPuntos({ combos: true, ofertas: false })).toBe(' (sin contar productos en oferta)');
    expect(aclaracionPuntos({ combos: false, ofertas: true })).toBe(' (sin contar combos)');
    expect(aclaracionPuntos({ combos: true, ofertas: true })).toBe('');
  });
});
