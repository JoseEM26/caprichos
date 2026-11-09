import { aplicarVacaciones, contarDiasHabiles, diasGanados, efectoEnSaldo, fechasDelRango, mesesCumplidos, rangosSeCruzan, resumenSaldo } from './vacaciones.calculo';

describe('vacaciones.calculo', () => {
  it('mesesCumplidos cuenta el mes al llegar al día de ingreso', () => {
    expect(mesesCumplidos('2026-01-15', '2026-02-14')).toBe(0);
    expect(mesesCumplidos('2026-01-15', '2026-02-15')).toBe(1);
    expect(mesesCumplidos('2026-01-15', '2027-01-15')).toBe(12);
    expect(mesesCumplidos('2026-01-31', '2026-02-28')).toBe(1); // fin de mes cuenta completo
    expect(mesesCumplidos('2026-06-01', '2026-01-01')).toBe(0); // nunca negativo
  });

  it('diasGanados: 30 días/año = 2.5 por mes; 15 = 1.25', () => {
    expect(diasGanados('2026-01-01', '2026-04-01', 30)).toBe(7.5);
    expect(diasGanados('2026-01-01', '2026-04-01', 15)).toBe(3.75);
    expect(diasGanados('2026-01-01', '2027-01-01', 30)).toBe(30);
  });

  it('saldo = ganados + ajustes − tomadas − pagadas, sin contar anulados', () => {
    const r = resumenSaldo(10, [
      { tipo: 'TOMADAS', dias: 3 },
      { tipo: 'PAGADAS', dias: 2 },
      { tipo: 'AJUSTE', dias: 1.5 },
      { tipo: 'AJUSTE', dias: -0.5 },
      { tipo: 'TOMADAS', dias: 5, anulado: true },
    ]);
    expect(r).toEqual({ ganados: 10, tomadas: 3, pagadas: 2, ajustes: 1, saldo: 6 });
    expect(efectoEnSaldo({ tipo: 'TOMADAS', dias: 2 })).toBe(-2);
    expect(efectoEnSaldo({ tipo: 'AJUSTE', dias: -1 })).toBe(-1);
    expect(efectoEnSaldo({ tipo: 'PAGADAS', dias: 2, anulado: true })).toBe(0);
  });

  it('aplicarVacaciones paga la jornada programada sin tardanza y deja el día sin turno igual', () => {
    const base = { estado: 'FALTA' as const, tardanzaMin: 10, salidaAnticipadaMin: 5, extraMin: 20 };
    const r = aplicarVacaciones(
      [
        { jornada: '2026-11-09', programadaMin: 300, trabajadaMin: 0, ...base },
        { jornada: '2026-11-10', programadaMin: 0, trabajadaMin: 0, ...base, estado: 'DESCANSO' },
        { jornada: '2026-11-11', programadaMin: 300, trabajadaMin: 0, ...base },
      ],
      new Set(['2026-11-09', '2026-11-10']),
    );
    expect(r[0]).toMatchObject({ estado: 'VACACIONES', trabajadaMin: 300, tardanzaMin: 0, extraMin: 0 });
    expect(r[1].estado).toBe('DESCANSO');
    expect(r[2].estado).toBe('FALTA');
  });

  it('días hábiles según su horario y rangos', () => {
    expect(fechasDelRango('2026-11-09', '2026-11-11')).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(contarDiasHabiles([{ turno: {} }, { turno: null }, { turno: {} }])).toBe(2);
    expect(rangosSeCruzan({ desde: '2026-11-01', hasta: '2026-11-05' }, { desde: '2026-11-05', hasta: '2026-11-09' })).toBe(true);
    expect(rangosSeCruzan({ desde: '2026-11-01', hasta: '2026-11-04' }, { desde: '2026-11-05', hasta: '2026-11-09' })).toBe(false);
  });
});
