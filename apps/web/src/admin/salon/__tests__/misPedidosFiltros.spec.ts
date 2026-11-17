import { describe, it, expect } from 'vitest';
import {
  MODALIDADES_FILTRO,
  SIN_AVANZADOS,
  chipDeUrl,
  contarAvanzados,
  errorMontos,
  parametrosDeChip,
  textoPeriodo,
  valorDeOpcion,
} from '../misPedidosFiltros';

const HOY = '2026-10-29';

describe('misPedidosFiltros: chips de periodo', () => {
  it('«Este mes» va del día 1 a hoy; «Mes pasado» es el mes anterior completo', () => {
    expect(parametrosDeChip('mes', '', '', HOY)).toEqual({ desde: '2026-10-01', hasta: HOY });
    expect(parametrosDeChip('mesPasado', '', '', HOY)).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
  });

  it('«Mes pasado» en enero cruza al año anterior', () => {
    expect(parametrosDeChip('mesPasado', '', '', '2026-01-15')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
  });

  it('«Hoy», «Ayer» y «7 días» usan el rango de la API', () => {
    expect(parametrosDeChip('hoy', '', '', HOY)).toEqual({ rango: 'hoy' });
    expect(parametrosDeChip('ayer', '', '', HOY)).toEqual({ rango: 'ayer' });
    expect(parametrosDeChip('semana', '', '', HOY)).toEqual({ rango: '7dias' });
  });

  it('«Rango» solo pide con fechas válidas dentro de 92 días', () => {
    expect(parametrosDeChip('rango', '2026-07-30', HOY, HOY)).toEqual({ desde: '2026-07-30', hasta: HOY });
    expect(parametrosDeChip('rango', '2026-07-29', HOY, HOY)).toBeNull();
    expect(parametrosDeChip('rango', '2026-10-10', '2026-10-09', HOY)).toBeNull();
    expect(parametrosDeChip('rango', '2026-10-01', '2026-10-30', HOY)).toBeNull();
    expect(parametrosDeChip('rango', '', HOY, HOY)).toBeNull();
  });

  it('chipDeUrl: lo desconocido o los valores viejos (30dias, todas) caen en hoy', () => {
    expect(chipDeUrl('mes')).toBe('mes');
    expect(chipDeUrl('mesPasado')).toBe('mesPasado');
    expect(chipDeUrl('30dias')).toBe('hoy');
    expect(chipDeUrl('todas')).toBe('hoy');
    expect(chipDeUrl(null)).toBe('hoy');
  });
});

describe('misPedidosFiltros: filtros avanzados', () => {
  it('contarAvanzados cuenta cada grupo activo una vez', () => {
    expect(contarAvanzados(SIN_AVANZADOS)).toBe(0);
    expect(
      contarAvanzados({ ...SIN_AVANZADOS, estados: ['COLA', 'LISTO'], faltaVoucher: true, metodo: 'YAPE', montoMin: '5', montoMax: '9' }),
    ).toBe(5);
  });

  it('errorMontos: el mínimo no puede pasar del máximo; sin signo', () => {
    expect(errorMontos('', '')).toBeNull();
    expect(errorMontos('10', '10')).toBeNull();
    expect(errorMontos('20', '10')).toMatch(/no puede ser mayor/);
    expect(errorMontos('-3', '')).toMatch(/sin signo/);
  });

  it('valorDeOpcion: un valor de la URL que no existe vuelve a «todos»', () => {
    expect(valorDeOpcion('DELIVERY', MODALIDADES_FILTRO)).toBe('DELIVERY');
    expect(valorDeOpcion('MARCIANO', MODALIDADES_FILTRO)).toBe('todos');
  });
});

describe('misPedidosFiltros: texto del periodo', () => {
  it('un día, un rango del mismo mes, un rango entre meses y sin inicio', () => {
    expect(textoPeriodo({ desde: '2026-11-03', hasta: '2026-11-03' })).toBe('del 3 nov');
    expect(textoPeriodo({ desde: '2026-11-03', hasta: '2026-11-09' })).toBe('del 3 al 9 nov');
    expect(textoPeriodo({ desde: '2026-10-28', hasta: '2026-11-02' })).toBe('del 28 oct al 2 nov');
    expect(textoPeriodo({ desde: null, hasta: '2026-11-09' })).toBe('hasta el 9 nov');
  });
});
