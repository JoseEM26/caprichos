import { turnoDe } from './asistencia.calculo';
import {
  calcularDiaPlanilla,
  calcularPlanilla,
  periodoDe,
  sueldoEquivalente,
  DiaPlanilla,
  pagoDia,
  pagoPorDiaPersona,
  PCT_TARDANZA_DEFECTO,
  valorHoraPersona,
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
    expect(pagoDia(d[0], 8, 0, true, 1.25)).toBe(82);
    expect(calcularPlanilla({ ...base, sueldoPeriodo: 0, dias: d, valorHora: 8, multiplicadorExtra: 1.25 }).pagoExtra).toBe(0);
  });

  it('tardanza al 0 %: solo se pagan los minutos trabajados', () => {
    const d = [dia({ programadaMin: 540, trabajadaMin: 510, tardanzaMin: 30 })];
    const r = calcularPlanilla({ ...base, pctTardanza: PCT_TARDANZA_DEFECTO, sueldoPeriodo: 0, dias: d, valorHora: 6 });
    expect(PCT_TARDANZA_DEFECTO).toBe(0);
    expect(r.pagoTardanza).toBe(0);
    expect(r.ganado).toBe(51);
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
