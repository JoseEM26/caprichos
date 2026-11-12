import { resolverFiltros, hoyLimaISO, enTurno, MAX_DIAS_ANALISIS } from './filtros';
import { resumirMinutos, minutosEntre } from './estadistica';

// 12-nov-2026 03:00 UTC = 11-nov 22:00 en Lima
/** Mensaje de negocio de un BadRequestException({ codigo, mensaje }). */
const msg = (f: () => unknown): string => {
  try { f(); } catch (e: any) { return e.getResponse().mensaje; }
  return '';
};

const AHORA = new Date('2026-11-12T03:00:00Z');

describe('resolverFiltros', () => {
  it('sin fechas: hoy en Lima (no el día UTC)', () => {
    expect(hoyLimaISO(AHORA)).toBe('2026-11-11');
    const r = resolverFiltros({}, AHORA);
    expect(r).toMatchObject({ desde: '2026-11-11', hasta: '2026-11-11', dias: 1, modalidad: null, canal: null, turno: null });
    expect(r.inicio.toISOString()).toBe('2026-11-11T05:00:00.000Z');
    expect(r.fin.toISOString()).toBe('2026-11-12T05:00:00.000Z');
  });

  it('acepta un rango de hasta 92 días y rechaza 93', () => {
    expect(resolverFiltros({ desde: '2026-08-12', hasta: '2026-11-11' }, AHORA).dias).toBe(MAX_DIAS_ANALISIS);
    expect(msg(() => resolverFiltros({ desde: '2026-08-11', hasta: '2026-11-11' }, AHORA))).toMatch(/92/);
  });

  it('rechaza fechas mal escritas, invertidas y futuras', () => {
    expect(() => resolverFiltros({ desde: '11/11/2026' }, AHORA)).toThrow();
    expect(() => resolverFiltros({ desde: '2026-13-40', hasta: '2026-13-41' }, AHORA)).toThrow();
    expect(msg(() => resolverFiltros({ desde: '2026-11-11', hasta: '2026-11-10' }, AHORA))).toMatch(/posterior/);
    expect(msg(() => resolverFiltros({ desde: '2026-11-11', hasta: '2026-11-12' }, AHORA))).toMatch(/futuro/);
  });

  it('valida modalidad, canal y turno; «todos» es sin filtro', () => {
    expect(resolverFiltros({ modalidad: 'delivery', canal: 'todos', turno: 'noche' }, AHORA)).toMatchObject({ modalidad: 'DELIVERY', canal: null, turno: 'NOCHE' });
    expect(() => resolverFiltros({ modalidad: 'VOLADOR' }, AHORA)).toThrow();
    expect(() => resolverFiltros({ turno: 'MADRUGADA' }, AHORA)).toThrow();
  });

  it('turnos por hora de Lima', () => {
    expect(enTurno(new Date('2026-11-11T14:59:00Z'), 'MANANA')).toBe(true); // 09:59
    expect(enTurno(new Date('2026-11-11T17:00:00Z'), 'TARDE')).toBe(true); // 12:00
    expect(enTurno(new Date('2026-11-11T23:00:00Z'), 'NOCHE')).toBe(true); // 18:00
    expect(enTurno(new Date('2026-11-11T23:00:00Z'), 'TARDE')).toBe(false);
  });
});

describe('estadística de minutos', () => {
  it('promedio, mediana y p90; ignora nulos', () => {
    expect(resumirMinutos([1, 2, 3, 4, null, undefined])).toEqual({ n: 4, promedio: 2.5, mediana: 2.5, p90: 3.7, maximo: 4 });
  });
  it('sin datos: nulos, no ceros', () => {
    expect(resumirMinutos([null])).toEqual({ n: 0, promedio: null, mediana: null, p90: null, maximo: null });
  });
  it('un solo dato', () => {
    expect(resumirMinutos([7])).toEqual({ n: 1, promedio: 7, mediana: 7, p90: 7, maximo: 7 });
  });
  it('minutosEntre: nulo si falta una marca o el orden es inverso', () => {
    expect(minutosEntre(new Date(0), new Date(90000))).toBe(1.5);
    expect(minutosEntre(null, new Date())).toBeNull();
    expect(minutosEntre(new Date(10), new Date(0))).toBeNull();
  });
});
