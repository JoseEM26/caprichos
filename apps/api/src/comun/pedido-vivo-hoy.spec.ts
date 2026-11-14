import { pedidoVivoDeHoy } from './fechas-lima';

describe('pedidoVivoDeHoy (D)', () => {
  it('filtra desde las 00:00 de Lima de hoy: lo de ayer queda fuera', () => {
    const f = pedidoVivoDeHoy(new Date('2026-11-13T15:00:00Z')); // 10:00 Lima del 13/11
    expect(f.creado_en.gte.toISOString()).toBe('2026-11-13T05:00:00.000Z');
    // 23:30 Lima del 12/11 (04:30Z del 13/11) sigue siendo «ayer»
    expect(new Date('2026-11-13T04:30:00Z') < f.creado_en.gte).toBe(true);
  });
});
