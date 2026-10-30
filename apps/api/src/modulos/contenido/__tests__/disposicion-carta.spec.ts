import { BadRequestException } from '@nestjs/common';
import { DISPOSICION_CARTA_DEFECTO, resolverDisposicionCarta } from '../disposicion-carta';

describe('disposicion de la carta', () => {
  it('sin datos devuelve exactamente el diseño anterior (por defecto)', () => {
    expect(resolverDisposicionCarta(undefined)).toEqual(DISPOSICION_CARTA_DEFECTO);
    expect(resolverDisposicionCarta(null)).toEqual(DISPOSICION_CARTA_DEFECTO);
    expect(DISPOSICION_CARTA_DEFECTO.secciones.map((s) => s.id)).toEqual([
      'mes', 'franja', 'momentos', 'novedades', 'categorias',
    ]);
  });

  it('acepta un orden completo con secciones ocultas', () => {
    const r = resolverDisposicionCarta({
      secciones: [
        { id: 'novedades', visible: true },
        { id: 'mes', visible: true },
        { id: 'categorias', visible: true },
        { id: 'momentos', visible: false },
        { id: 'franja', visible: true },
      ],
    }, true);
    expect(r.secciones[0]).toEqual({ id: 'novedades', visible: true });
    expect(r.secciones.find((s) => s.id === 'momentos')?.visible).toBe(false);
  });

  it('rechaza en estricto valores fuera de catálogo y orden incompleto', () => {
    expect(() => resolverDisposicionCarta({ banner: { tamanoPc: 'enorme' } }, true)).toThrow(BadRequestException);
    expect(() => resolverDisposicionCarta({ carta: { columnasPc: '7' } }, true)).toThrow(BadRequestException);
    expect(() => resolverDisposicionCarta({ secciones: [{ id: 'mes', visible: true }] }, true)).toThrow(BadRequestException);
    expect(() => resolverDisposicionCarta({ secciones: 'x' }, true)).toThrow(BadRequestException);
  });

  it('sin estricto cae al valor por defecto y no rompe la carta pública', () => {
    const r = resolverDisposicionCarta({ banner: { tamanoPc: 'enorme', ajusteFoto: 'contener' }, momentos: { tamano: 'grande' } });
    expect(r.banner.tamanoPc).toBe('normal');
    expect(r.banner.ajusteFoto).toBe('contener');
    expect(r.momentos.tamano).toBe('grande');
  });
});
