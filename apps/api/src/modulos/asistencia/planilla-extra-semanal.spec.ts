import { DiaPlanilla, extraSemanal } from './planilla.calculo';

const dia = (jornada: string, programadaH: number, trabajadaH: number, extraH: number): DiaPlanilla => ({
  jornada, estado: 'CUMPLIO', programadaMin: programadaH * 60, trabajadaMin: trabajadaH * 60, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: extraH * 60,
});
// Semana lunes 2026-11-16 a domingo 2026-11-22, jornada 9 h × 6 días = 54 h
const semana = (trabajos: Array<[number, number]>) =>
  trabajos.map(([t, e], i) => dia(`2026-11-${16 + i}`, 9, t, e));

describe('Hora extra semanal: solo pasado lo programado de la semana', () => {
  it('vino 1 día y se quedó 2 h: no hay extra, las 2 h se pagan como horas normales', () => {
    const r = extraSemanal(semana([[9, 2], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
    expect(r.reduce((a, d) => a + d.extraMin, 0)).toBe(0);
    expect(r[0].trabajadaMin).toBe(11 * 60);
  });

  it('cumplió las 54 h y se quedó 2 h un día: esas 2 h sí son extra', () => {
    const r = extraSemanal(semana([[9, 2], [9, 0], [9, 0], [9, 0], [9, 0], [9, 0]]));
    expect(r[0].extraMin).toBe(120);
    expect(r[0].trabajadaMin).toBe(9 * 60);
  });

  it('faltó 1 h en la semana y se quedó 3 h: 1 h pasa a normal y 2 h quedan como extra', () => {
    const r = extraSemanal(semana([[9, 3], [8, 0], [9, 0], [9, 0], [9, 0], [9, 0]]));
    expect(r[0].extraMin).toBe(120);
    expect(r[0].trabajadaMin).toBe(10 * 60);
  });

  it('cada semana se cuenta aparte y no se modifica la entrada', () => {
    const dias = [dia('2026-11-22', 0, 0, 4), dia('2026-11-23', 9, 0, 0), dia('2026-11-24', 0, 0, 2)];
    const r = extraSemanal(dias);
    expect(r[0].extraMin).toBe(240); // domingo 22: su semana no tenía horas programadas
    expect(r[2].extraMin).toBe(0); // semana del 23: faltó 9 h programadas
    expect(dias[2].extraMin).toBe(120);
  });

  it('guarda la extra original del día para explicar en pantalla cuánto pasó a hora normal', () => {
    const r = extraSemanal(semana([[9, 3], [8, 0], [9, 0], [9, 0], [9, 0], [9, 0]]));
    expect(r[0].extraBrutaMin).toBe(180);
    expect(r[0].extraMin).toBe(120);
  });
});
