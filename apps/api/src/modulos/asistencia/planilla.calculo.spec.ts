import { turnoDe } from './asistencia.calculo';
import {
  calcularDiaPlanilla,
  calcularPlanilla,
  periodoDe,
  sueldoEquivalente,
  DiaPlanilla,
  pagoDia,
  pagoPorDiaPersona,
  PENALIDAD_TARDANZA_PCT_DEFECTO,
  penalidadTardanzaDia,
  valorHoraPersona,
} from './planilla.calculo';

const dia = (over: Partial<DiaPlanilla> = {}): DiaPlanilla => ({
  jornada: '2026-11-02', estado: 'CUMPLIO', programadaMin: 0, trabajadaMin: 0, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, ...over,
});
const base = { modalidad: 'MENSUAL' as const, penalidadTardanzaPct: 0, extrasAprobadas: new Set<string>(), consumos: [], descuentos: [], adelantos: [] };

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

describe('calcularDiaPlanilla (turno 13:30-22:30 con break 30 min PAGADO, tolerancia 5)', () => {
  const turno = turnoDe(810, 1350, 1050, 1080); // 13:30-22:30, break 17:30-18:00
  const m = (tipo: any, minutos: number) => ({ tipo, minutos, estado: 'VALIDA' as const });
  const completo = (e: number, s: number) => [m('ENTRADA', e), m('SALIDA', s)];

  it('programa 9 h (el break se paga) y paga completo si cumple', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: completo(810, 1350) }, 5);
    expect(r).toMatchObject({ programadaMin: 540, trabajadaMin: 540, tardanzaMin: 0, extraMin: 0 });
  });
  it('tardanza dentro de la tolerancia no resta', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: completo(814, 1350) }, 5);
    expect(r.trabajadaMin).toBe(540);
    expect(r.tardanzaMin).toBe(0);
  });
  it('tardanza pasada la tolerancia: minutos de tardanza aparte, no se pagan como trabajados', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'TARDANZA', turno, marcas: completo(830, 1350) }, 5);
    expect(r.tardanzaMin).toBe(20);
    expect(r.trabajadaMin).toBe(520);
  });
  it('salida anticipada: minutos no trabajados, no se pagan', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'SALIO_ANTES', turno, marcas: completo(810, 1290) }, 5);
    expect(r.salidaAnticipadaMin).toBe(60);
    expect(r.trabajadaMin).toBe(480);
  });
  it('el break se paga aunque sea más largo o no se marque', () => {
    const marcas = [m('ENTRADA', 810), m('SALIDA_ALMUERZO', 1050), m('ENTRADA_ALMUERZO', 1110), m('SALIDA', 1350)];
    expect(calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas, breakMin: 60 }, 5).trabajadaMin).toBe(540);
    expect(calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: completo(810, 1350) }, 5).trabajadaMin).toBe(540);
  });
  it('lo trabajado fuera del turno es extra y no entra en el pago base', () => {
    const r = calcularDiaPlanilla({ jornada: 'x', estado: 'SALIO_DESPUES', turno, marcas: completo(810, 1410) }, 5);
    expect(r.extraMin).toBe(60);
    expect(r.trabajadaMin).toBe(540);
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
  it('el 50 % de tardanza ya no existe: sin factor no hay pago de tardanza ni campo pagoTardanza', () => {
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias: [dia({ programadaMin: 3000, trabajadaMin: 1740, tardanzaMin: 60 })] });
    expect(r.pagoTrabajado).toBe(580);
    expect(r.ganado).toBe(580);
    expect(r).not.toHaveProperty('pagoTardanza');
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
    expect(pagoDia(dias(2)[0], 20, false)).toBe(320);
    expect(con.ganado).toBe(sin.ganado + 160);
  });
  it('sin recargo todo queda igual que antes', () => {
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 1600, dias: dias() }).ganado).toBe(1600);
  });
  it('penalidad en feriado: sobre el valor hora ya recargado', () => {
    const d = dia({ programadaMin: 480, trabajadaMin: 420, tardanzaMin: 60, recargo: 2 });
    expect(pagoDia(d, 20, false)).toBe(7 * 40);
    expect(calcularPlanilla({ ...base, penalidadTardanzaPct: 100, sueldoPeriodo: 160, dias: [d] }).penalidadTardanza).toBe(40);
  });
  it('la hora extra aprobada no lleva recargo', () => {
    expect(pagoDia(dia({ extraMin: 60, recargo: 2 }), 20, true)).toBe(20);
  });
});

describe('valor hora por persona (planilla estilo Excel)', () => {
  const dias = [dia({ programadaMin: 540, trabajadaMin: 625 })]; // 10 h 25 min

  it('DIAS_HORAS: 1500 ÷ 24 ÷ 9 = 6.9444…/h y 10 h 25 min = 72.34', () => {
    const vh = valorHoraPersona({ metodo: 'DIAS_HORAS', sueldoMensual: 1500 })!;
    expect(vh).toBeCloseTo(6.9444, 4);
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1500, dias, valorHora: vh });
    expect(r.valorHora).toBe(6.94);
    expect(r.ganado).toBe(72.34); // se calcula con el valor hora sin redondear (con 6.94 saldría 72.29)
  });

  it('÷ 8 por persona, defectos 24 y 9, y pago por día', () => {
    expect(valorHoraPersona({ metodo: 'DIAS_HORAS', sueldoMensual: 1200, horasDia: 8 })).toBeCloseTo(6.25, 6);
    expect(valorHoraPersona({ metodo: 'DIAS_HORAS', sueldoMensual: 1080, diasMes: 30, horasDia: 9 })).toBeCloseTo(4, 6);
    expect(pagoPorDiaPersona({ metodo: 'DIAS_HORAS', sueldoMensual: 1500 })).toBe(62.5);
  });

  it('TARIFA_HORA fija por hora (sin sueldo) y PROGRAMADAS depende de las horas del período', () => {
    expect(valorHoraPersona({ metodo: 'TARIFA_HORA', sueldoMensual: 0, tarifaHora: 15 })).toBe(15);
    expect(valorHoraPersona({ metodo: 'PROGRAMADAS', sueldoMensual: 1000 })).toBeNull();
    expect(pagoPorDiaPersona({ metodo: 'TARIFA_HORA', sueldoMensual: 0, tarifaHora: 15 })).toBeNull();
  });

  it('PROGRAMADAS no cambia: sueldo ÷ horas programadas y la extra ×1', () => {
    const d = [dia({ programadaMin: 3000, trabajadaMin: 1800, extraMin: 60 })];
    const r = calcularPlanilla({ ...base, sueldoPeriodo: 1000, dias: d, extrasAprobadas: new Set(['2026-11-02']) });
    expect(r.valorHora).toBe(20);
    expect(r.pagoExtra).toBe(20);
  });

  it('hora extra aprobada ×1.25 y solo si se aprueba', () => {
    const d = [dia({ programadaMin: 540, trabajadaMin: 540, extraMin: 60 })];
    const aprobada = calcularPlanilla({ ...base, sueldoPeriodo: 0, dias: d, valorHora: 8, multiplicadorExtra: 1.25, extrasAprobadas: new Set(['2026-11-02']) });
    expect(aprobada.pagoExtra).toBe(10);
    expect(pagoDia(d[0], 8, true, 1.25)).toBe(82);
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 0, dias: d, valorHora: 8, multiplicadorExtra: 1.25 }).pagoExtra).toBe(0);
  });

  it('neto estilo Excel: total + adicional − descuentos por etiqueta; diferencia = neto − adelantos', () => {
    const d = [dia({ programadaMin: 540, trabajadaMin: 540 })];
    const r = calcularPlanilla({
      ...base,
      sueldoPeriodo: 0,
      dias: d,
      valorHora: 10,
      bonos: [20],
      lineasDescuento: [{ categoria: 'NETFLIX', monto: 1.64 }, { categoria: 'MERMA', monto: 10 }, { categoria: 'MERMA', monto: 5 }],
      consumos: [{ id: '1', monto: 8, cobrar: true }],
      adelantos: [30],
    });
    expect(r.ganado).toBe(90);
    expect(r.descuentosPorCategoria).toEqual({ CONSUMO: 8, NETFLIX: 1.64, MERMA: 15 });
    expect(r.netoAPagar).toBe(85.36); // 90 + 20 − 8 − 16.64
    expect(r.neto).toBe(55.36);
  });
});

describe('penalidad por tardanza (valor del tiempo no pagado × factor)', () => {
  const horaDe = (tardanzaMin: number, vh: number, pct: number, extra: Partial<Parameters<typeof calcularPlanilla>[0]> = {}) =>
    calcularPlanilla({ ...base, penalidadTardanzaPct: pct, sueldoPeriodo: 0, valorHora: vh, dias: [dia({ programadaMin: 540, trabajadaMin: 540 - tardanzaMin, tardanzaMin })], ...extra });

  it('60 min con S/10/h: no se pagan S/10 y se descuentan S/10 (S/20 menos en total)', () => {
    const r = horaDe(60, 10, 100);
    expect(r.pagoTrabajado).toBe(80); // 8 h × 10
    expect(r.penalidadTardanza).toBe(10);
    expect(r.neto).toBe(70); // 90 de pleno − 10 no pagados − 10 de penalidad
  });
  it('60 min con S/30/h: S/30 + S/30', () => {
    const r = horaDe(60, 30, 100);
    expect(r.penalidadTardanza).toBe(30);
    expect(r.pagoTrabajado).toBe(240);
    expect(r.neto).toBe(210);
  });
  it('proporcional: 10 y 20 min con S/12/h (0,20 por minuto)', () => {
    expect(horaDe(10, 12, 100).penalidadTardanza).toBe(2);
    expect(horaDe(20, 12, 100).penalidadTardanza).toBe(4);
    expect(horaDe(20, 12, 100).penalidadTardanzaDetalle).toEqual([{ fecha: '2026-11-02', minutos: 20, monto: 4 }]);
  });
  it('factor 0 = sin penalidad; 200 = el doble; defecto 100', () => {
    expect(horaDe(60, 10, 0).penalidadTardanza).toBe(0);
    expect(horaDe(60, 10, 0).penalidadTardanzaDetalle).toEqual([]);
    expect(horaDe(60, 10, 200).penalidadTardanza).toBe(20);
    expect(PENALIDAD_TARDANZA_PCT_DEFECTO).toBe(100);
  });
  it('dentro de la tolerancia no hay penalidad (lo decide calcularDiaPlanilla)', () => {
    const turno = turnoDe(810, 1350, 1050, 1080);
    const d = calcularDiaPlanilla({ jornada: 'x', estado: 'CUMPLIO', turno, marcas: [{ tipo: 'ENTRADA', minutos: 815, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1350, estado: 'VALIDA' }] }, 5);
    expect(penalidadTardanzaDia(d, 10, 100)).toBe(0);
    const tarde = calcularDiaPlanilla({ jornada: 'x', estado: 'TARDANZA', turno, marcas: [{ tipo: 'ENTRADA', minutos: 870, estado: 'VALIDA' }, { tipo: 'SALIDA', minutos: 1350, estado: 'VALIDA' }] }, 5);
    expect(tarde.tardanzaMin).toBe(60);
    expect(penalidadTardanzaDia(tarde, 10, 100)).toBe(10);
  });
  it('mensual (DIAS_HORAS 1500/24/9), por horas (PROGRAMADAS) y tarifa fija usan su valor hora', () => {
    const vhMensual = valorHoraPersona({ metodo: 'DIAS_HORAS', sueldoMensual: 1500 })!; // 6.9444…
    expect(horaDe(60, vhMensual, 100).penalidadTardanza).toBe(6.94);
    expect(horaDe(60, valorHoraPersona({ metodo: 'TARIFA_HORA', sueldoMensual: 0, tarifaHora: 15 })!, 100).penalidadTardanza).toBe(15);
    // PROGRAMADAS: sueldo 1000 ÷ 50 h = 20/h
    const r = calcularPlanilla({ ...base, penalidadTardanzaPct: 100, sueldoPeriodo: 1000, dias: [dia({ programadaMin: 3000, trabajadaMin: 1740, tardanzaMin: 60 })] });
    expect(r.penalidadTardanza).toBe(20);
  });
  it('la penalidad va en su propia línea: no se mezcla con adelantos ni consumos', () => {
    const r = horaDe(60, 10, 100, { adelantos: [5], consumos: [{ id: '1', monto: 3, cobrar: true }] });
    expect(r.descuentosPorCategoria).toEqual({ CONSUMO: 3, TARDANZA: 10 });
    expect(r.adelantos).toBe(5);
    expect(r.descuentos).toBe(0);
    expect(r.neto).toBe(80 - 3 - 10 - 5);
  });
});
