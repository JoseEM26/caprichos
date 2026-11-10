import { turnoDe } from './asistencia.calculo';
import {
  calcularDiaPlanilla,
  calcularPlanilla,
  periodoDe,
  sueldoEquivalente,
  DiaPlanilla,
  pagoDia,
} from './planilla.calculo';

const dia = (over: Partial<DiaPlanilla> = {}): DiaPlanilla => ({
  jornada: '2026-11-02', estado: 'CUMPLIO', programadaMin: 0, trabajadaMin: 0, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, ...over,
});
const base = { modalidad: 'MENSUAL' as const, pctTardanza: 50, extrasAprobadas: new Set<string>(), consumos: [], descuentos: [], adelantos: [] };

describe('sueldoEquivalente', () => {
  it('mensual a semanal: ×12/52', () => {
    expect(sueldoEquivalente('MENSUAL', 1000)).toEqual({ semanal: 230.77, mensual: 1000 });
  });
  it('semanal a mensual: ×52/12', () => {
    expect(sueldoEquivalente('SEMANAL', 300)).toEqual({ semanal: 300, mensual: 1300 });
  });
});

describe('periodoDe', () => {
  it('semana de lunes a domingo (un domingo pertenece a la semana que termina)', () => {
    expect(periodoDe('SEMANAL', '2026-11-09')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
    expect(periodoDe('SEMANAL', '2026-11-15')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
    expect(periodoDe('SEMANAL', '2026-11-11')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });
  it('mes calendario', () => {
    expect(periodoDe('MENSUAL', '2028-02-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
});

describe('calcularDiaPlanilla (turno 13:30-22:30 con break 30 min, tolerancia 5)', () => {
  const turno = turnoDe(810, 1350, 1050, 1080); // 13:30-22:30, break 17:30-18:00
  const m = (tipo: any, minutos: number) => ({ tipo, minutos, estado: 'VALIDA' as const });
  const completo = (e: number, s: number) => [m('ENTRADA', e), m('SALIDA', s)];

  it('programa 8,5 h netas y paga completo si cumple', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: completo(810, 1350) }, 5);
    expect(r).toMatchObject({ programadaMin: 510, trabajadaMin: 510, tardanzaMin: 0, extraMin: 0 });
  });
  it('tardanza dentro de la tolerancia no resta', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: completo(814, 1350) }, 5);
    expect(r.trabajadaMin).toBe(510);
    expect(r.tardanzaMin).toBe(0);
  });
  it('tardanza pasada la tolerancia: minutos de tardanza aparte, no se pagan como trabajados', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'TARDANZA', turno, marcas: completo(830, 1350) }, 5);
    expect(r.tardanzaMin).toBe(20);
    expect(r.trabajadaMin).toBe(490);
  });
  it('salida anticipada: minutos no trabajados, no se pagan', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'SALIO_ANTES', turno, marcas: completo(810, 1290) }, 5);
    expect(r.salidaAnticipadaMin).toBe(60);
    expect(r.trabajadaMin).toBe(450);
  });
  it('el break real se descuenta (más largo = menos pagado)', () => {
    const marcas = [m('ENTRADA', 810), m('SALIDA_ALMUERZO', 1050), m('ENTRADA_ALMUERZO', 1110), m('SALIDA', 1350)];
    expect(calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas }, 5).trabajadaMin).toBe(480);
  });
  it('lo trabajado fuera del turno es extra y no entra en el pago base', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'SALIO_DESPUES', turno, marcas: completo(810, 1410) }, 5);
    expect(r.extraMin).toBe(60);
    expect(r.trabajadaMin).toBe(510);
  });
  it('falta, incompleto o por revisar no pagan', () => {
    for (const estado of ['FALTA', 'INCOMPLETO', 'A_REVISAR', 'SIN_EVALUAR'] as const) {
      expect(calcularDiaPlanilla({ jornada: 'x', estado, turno, marcas: completo(810, 1350) }, 5).trabajadaMin).toBe(0);
    }
  });
  it('descanso: sin turno, 0 programado', () => {
    expect(calcularDiaPlanilla({ jornada: 'x', estado: 'DESCANSO', turno: null, marcas: [] }, 5).programadaMin).toBe(0);
  });
});

describe('calcularPlanilla', () => {
  it('ejemplo del dueño: S/1000 mensual, 50 h programadas, 30 h trabajadas = S/600', () => {
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias: [dia({ programadaMin: 3000, trabajadaMin: 1800 })] });
    expect(r.valorHora).toBe(20);
    expect(r.ganado).toBe(600);
    expect(r.neto).toBe(600);
  });
  it('la tardanza se paga al 50 % (ya es el descuento, no se resta otra vez)', () => {
    // 50 h programadas, 29 h trabajadas + 1 h de tardanza (valor hora 20): 580 + 10
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias: [dia({ programadaMin: 3000, trabajadaMin: 1740, tardanzaMin: 60 })] });
    expect(r.pagoTrabajado).toBe(580);
    expect(r.pagoTardanza).toBe(10);
    expect(r.ganado).toBe(590);
  });
  it('el porcentaje de tardanza es configurable', () => {
    const r = calcularPlanilla({ ...base, pctTardanza: 100, sueldoPeriodo: 1000, dias: [dia({ programadaMin: 3000, trabajadaMin: 1740, tardanzaMin: 60 })] });
    expect(r.pagoTardanza).toBe(20);
  });
  it('la hora extra solo suma si el admin la aprobó', () => {
    const dias = [dia({ jornada: '2026-11-02', programadaMin: 3000, trabajadaMin: 3000, extraMin: 60 })];
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias }).ganado).toBe(1000);
    const ap = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias, extrasAprobadas: new Set(['2026-11-02']) });
    expect(ap.extraMin).toBe(60);
    expect(ap.extraAprobadaMin).toBe(60);
    expect(ap.ganado).toBe(1020);
  });
  it('resta consumos cobrados, descuentos y adelantos; los que pasan al siguiente período no se restan', () => {
    const r = calcularPlanilla({
      ...base,
      sueldoPeriodo: 1000,
      dias: [dia({ programadaMin: 3000, trabajadaMin: 3000 })],
      consumos: [{ id: '1', monto: 40, cobrar: true }, { id: '2', monto: 25.5, cobrar: false }],
      descuentos: [15.25],
      adelantos: [100, 50],
    });
    expect(r.consumosCobrados).toBe(40);
    expect(r.consumosPendientes).toBe(25.5);
    expect(r.neto).toBe(794.75);
  });
  it('sin horas programadas no hay valor hora ni pago', () => {
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias: [] });
    expect(r.ganado).toBe(0);
  });
});

describe('feriados (recargo del valor hora)', () => {
  // 10 días de 8 h = 80 h programadas; sueldo S/1600 → valor hora S/20
  const dias = (rec?: number) => [
    dia({ jornada: '2026-11-01', programadaMin: 480, trabajadaMin: 480, recargo: rec }),
    ...Array.from({ length: 9 }, (_, i) => dia({ jornada: `2026-11-${String(i + 2).padStart(2, '0')}`, programadaMin: 480, trabajadaMin: 480 })),
  ];
  it('8 h en feriado ×2 con valor hora S/20 pagan S/320; el valor hora no cambia', () => {
    const sin = calcularPlanilla({ ...base, sueldoPeriodo: 1600, dias: dias() });
    const con = calcularPlanilla({ ...base, sueldoPeriodo: 1600, dias: dias(2) });
    expect(sin.valorHora).toBe(20);
    expect(con.valorHora).toBe(20);
    expect(con.programadaMin).toBe(sin.programadaMin);
    expect(pagoDia(dias(2)[0], 20, 50, false)).toBe(320);
    expect(con.ganado).toBe(sin.ganado + 160);
  });
  it('sin recargo todo queda igual que antes', () => {
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 1600, dias: dias() }).ganado).toBe(1600);
  });
  it('tardanza en feriado: 50% del valor hora ya recargado', () => {
    const d = dia({ programadaMin: 480, trabajadaMin: 420, tardanzaMin: 60, recargo: 2 });
    expect(pagoDia(d, 20, 50, false)).toBe(7 * 40 + 1 * 40 * 0.5);
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 160, dias: [d] }).pagoTardanza).toBe(20);
  });
  it('la hora extra aprobada no lleva recargo', () => {
    expect(pagoDia(dia({ extraMin: 60, recargo: 2 }), 20, 50, true)).toBe(20);
  });
});
