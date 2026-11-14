import { debePasarACola, exigirPuedeProgramar, leerConfigProgramados, validarProgramadoPara } from './programado.util';

describe('programado.util', () => {
  const ahora = new Date('2026-11-13T15:00:00.000Z'); // 10:00 en Lima

  it('solo Caja, mozo, supervisor y admin pueden programar (el servidor lo exige)', () => {
    expect(() => exigirPuedeProgramar(['CAJERO'])).not.toThrow();
    expect(() => exigirPuedeProgramar(['COCINA', 'MOZO'])).not.toThrow();
    expect(() => exigirPuedeProgramar(['REPARTIDOR'])).toThrow();
    expect(() => exigirPuedeProgramar(['COCINA'])).toThrow();
    expect(() => exigirPuedeProgramar([])).toThrow();
  });

  it('valida futuro y tope de días de calendario de Lima', () => {
    expect(validarProgramadoPara('2026-11-14T17:00:00.000Z', ahora, 7)).toEqual(new Date('2026-11-14T17:00:00.000Z'));
    expect(() => validarProgramadoPara('2026-11-13T14:59:00.000Z', ahora, 7)).toThrow();
    expect(() => validarProgramadoPara('no es fecha', ahora, 7)).toThrow();
    // Hasta el día 20 (7 días) pasa; el 21 no
    expect(() => validarProgramadoPara('2026-11-20T23:00:00.000-05:00', ahora, 7)).not.toThrow();
    expect(() => validarProgramadoPara('2026-11-21T08:00:00.000-05:00', ahora, 7)).toThrow();
  });

  it('pasa a cola cuando la hora pactada menos el aviso ya llegó', () => {
    const pactada = new Date('2026-11-14T13:00:00.000Z'); // 08:00 Lima
    expect(debePasarACola(pactada, new Date('2026-11-14T12:29:00.000Z'), 30)).toBe(false);
    expect(debePasarACola(pactada, new Date('2026-11-14T12:30:00.000Z'), 30)).toBe(true);
    expect(debePasarACola(pactada, new Date('2026-11-14T13:00:00.000Z'), 0)).toBe(true);
  });

  it('los parámetros inválidos o ausentes usan los valores por defecto', async () => {
    const db = (filas: any[]) => ({ parametro: { findMany: jest.fn().mockResolvedValue(filas) } });
    expect(await leerConfigProgramados(db([]))).toEqual({ diasMax: 7, avisoMin: 30 });
    expect(await leerConfigProgramados(db([{ clave: 'programado_dias_max', valor: 3 }, { clave: 'programado_aviso_min', valor: 45 }]))).toEqual({ diasMax: 3, avisoMin: 45 });
    expect(await leerConfigProgramados(db([{ clave: 'programado_dias_max', valor: -1 }, { clave: 'programado_aviso_min', valor: 'x' }]))).toEqual({ diasMax: 7, avisoMin: 30 });
  });
});
