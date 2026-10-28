import { describe, it, expect } from 'vitest';
import {
  DISPOSICION_DEFECTO,
  anchoNovedad,
  gridColumnas,
  medidasBanner,
  medidasMomento,
  resolverDisposicion,
} from '../disposicion';

describe('disposicion de la carta (valores por defecto = diseño anterior)', () => {
  it('sin datos devuelve el orden y los tamaños de siempre', () => {
    expect(resolverDisposicion(undefined)).toEqual(DISPOSICION_DEFECTO);
    expect(DISPOSICION_DEFECTO.secciones.map((s) => s.id)).toEqual(['mes', 'franja', 'momentos', 'novedades', 'categorias']);
  });

  it('las medidas normales coinciden con las que tenía la portada, momentos y novedades', () => {
    expect(medidasBanner('normal', false)).toMatchObject({ padding: '36px 40px', titulo: 44, foto: 230 });
    expect(medidasBanner('normal', true)).toMatchObject({ padding: '18px 16px', titulo: 24, foto: 104 });
    expect(medidasMomento('normal', false)).toEqual({ circulo: 84, ancho: 96 });
    expect(medidasMomento('normal', true)).toEqual({ circulo: 60, ancho: 68 });
    expect(anchoNovedad('normal', false)).toBe('300px');
    expect(anchoNovedad('normal', true)).toBe('66%');
  });

  it('la cuadrícula de productos no cambia con el valor por defecto', () => {
    expect(gridColumnas(false, 'SECCIONES', 'auto')).toBe('repeat(auto-fill, minmax(230px, 1fr))');
    expect(gridColumnas(false, 'TARJETAS', 'auto')).toBe('repeat(auto-fill, minmax(320px, 1fr))');
    expect(gridColumnas(false, 'LISTA', '3')).toBe('1fr');
    expect(gridColumnas(true, 'SECCIONES', '4')).toBe('1fr');
    expect(gridColumnas(false, 'SECCIONES', '3')).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('valores fuera de catálogo o secciones repetidas caen al valor por defecto', () => {
    const r = resolverDisposicion({
      banner: { tamanoPc: 'enorme', focoFoto: 'izquierda' },
      secciones: [{ id: 'mes', visible: true }, { id: 'mes', visible: false }],
    });
    expect(r.banner.tamanoPc).toBe('normal');
    expect(r.banner.focoFoto).toBe('centro');
    expect(r.secciones).toEqual(DISPOSICION_DEFECTO.secciones);
  });
});
