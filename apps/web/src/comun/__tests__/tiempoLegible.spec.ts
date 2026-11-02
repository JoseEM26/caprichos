import { describe, it, expect } from 'vitest';
import { duracionLegible, haceLegible } from '../tiempoLegible';

const AHORA = Date.parse('2026-11-02T12:00:00Z');
const hace = (minutos: number) => new Date(AHORA - minutos * 60000).toISOString();

describe('duracionLegible', () => {
  it('menos de 60 min en minutos', () => {
    expect(duracionLegible(0)).toBe('0 min');
    expect(duracionLegible(25)).toBe('25 min');
    expect(duracionLegible(59)).toBe('59 min');
  });

  it('de 1 h a menos de 24 h en horas y minutos, sin «0 min» sobrante', () => {
    expect(duracionLegible(60)).toBe('1 h');
    expect(duracionLegible(80)).toBe('1 h 20 min');
    expect(duracionLegible(1439)).toBe('23 h 59 min');
  });

  it('desde 24 h en días, singular y plural', () => {
    expect(duracionLegible(1440)).toBe('1 día');
    expect(duracionLegible(4320)).toBe('3 días');
    expect(duracionLegible(4310)).toBe('2 días');
  });
});

describe('haceLegible', () => {
  it('convierte la fecha de un pedido en «hace …»', () => {
    expect(haceLegible(hace(25), AHORA)).toBe('hace 25 min');
    expect(haceLegible(hace(80), AHORA)).toBe('hace 1 h 20 min');
    expect(haceLegible(hace(4310), AHORA)).toBe('hace 2 días');
    expect(haceLegible(hace(3 * 1440), AHORA)).toBe('hace 3 días');
  });

  it('un minuto o menos dice que es reciente', () => {
    expect(haceLegible(hace(0), AHORA)).toBe('hace menos de 1 min');
  });

  it('sin fecha o con fecha inválida no devuelve nada', () => {
    expect(haceLegible(null, AHORA)).toBeNull();
    expect(haceLegible(undefined, AHORA)).toBeNull();
    expect(haceLegible('no es fecha', AHORA)).toBeNull();
  });
});
