import { diaSemana } from './asistencia.calculo';
import {
  DiaPlanilla,
  ReglaTarifaEspecial,
  aplicarTarifaEspecial,
  calcularDiaPlanilla,
  pagoDia,
  pagoTrabajadoDia,
  resumenTarifaEspecial,
  reglaTarifaDelDia,
  validarReglaTarifa,
} from './planilla.calculo';

// Datos ficticios: persona de S/ 6,94 la hora; domingo 15/11/2026; regla domingos desde las 19:00 a S/ 15 la hora.
const DOMINGO = '2026-11-15';
const VH = 6.94;
const regla = (over: Partial<ReglaTarifaEspecial> = {}): ReglaTarifaEspecial => ({
  diaSemana: 0, desdeMin: 19 * 60, tarifaHora: 15, vigenteDesde: '2026-11-15', vigenteHasta: null, activa: true, ...over,
});
const m = (tipo: any, minutos: number) => ({ tipo, minutos, estado: 'VALIDA' as const });
const TURNO_NOCHE = { entrada: 18 * 60, salida: 22 * 60 };
const TOL = 5;

/** Día de turno 18:00-22:00 con las marcas dadas. */
const diaConTurno = (marcas: Array<{ tipo: any; minutos: number; estado: 'VALIDA' }>, jornada = DOMINGO): DiaPlanilla =>
  calcularDiaPlanilla({ jornada, estado: 'CUMPLIO', turno: TURNO_NOCHE, marcas }, TOL);

describe('fechas de prueba', () => {
  it('el 15/11/2026 es domingo (0)', () => {
    expect(diaSemana(DOMINGO)).toBe(0);
  });
});

describe('tarifa especial en un día con turno (18:00-22:00, regla desde 19:00 a S/ 15)', () => {
  const base = () => aplicarTarifaEspecial(diaConTurno([m('ENTRADA', 18 * 60), m('SALIDA', 22 * 60)]), [regla()]);

  it('marca el día con la tarifa especial que le toca', () => {
    expect(base().tarifaEspecial).toEqual({ desdeMin: 19 * 60, tarifaHora: 15 });
  });
  it('1 h normal (18:00-19:00) + 3 h especiales (19:00-22:00) = 6,94 + 45', () => {
    expect(pagoTrabajadoDia(base(), VH)).toBeCloseTo(VH + 45, 2);
    expect(pagoDia(base(), VH, false)).toBeCloseTo(VH + 45, 2);
  });
  it('resumen del día: desde 19:00, S/ 15, 3 h especiales, ganado especial 45', () => {
    expect(resumenTarifaEspecial(base(), false)).toEqual({ desdeHora: '19:00', tarifaHora: 15, horasEspecialesH: 3, ganadoEspecial: 45 });
  });
  it('llegar tarde dentro de la tolerancia no cambia el tramo especial', () => {
    const d = aplicarTarifaEspecial(diaConTurno([m('ENTRADA', 18 * 60 + 4), m('SALIDA', 22 * 60)]), [regla()]);
    expect(pagoTrabajadoDia(d, VH)).toBeCloseTo(VH + 45, 2);
  });
  it('tardanza pasada la tolerancia: lo tarde no se paga y el tramo especial sigue desde las 19:00', () => {
    // entra 18:10 (tardanza 10 min): paga 18:10-19:00 normal (50 min) y 19:00-22:00 especial
    const d = aplicarTarifaEspecial(diaConTurno([m('ENTRADA', 18 * 60 + 10), m('SALIDA', 22 * 60)]), [regla()]);
    expect(d.tardanzaMin).toBe(10);
    expect(pagoTrabajadoDia(d, VH)).toBeCloseTo((50 / 60) * VH + 45, 2);
  });
  it('la extra aprobada va entera a la tarifa especial, sin multiplicador', () => {
    // entra 17:30 y sale 22:30: 60 min de extra (30 antes y 30 después), todos a S/ 15
    const d = aplicarTarifaEspecial(diaConTurno([m('ENTRADA', 17 * 60 + 30), m('SALIDA', 22 * 60 + 30)]), [regla()]);
    expect(d.extraMin).toBe(60);
    const sinExtra = pagoDia(d, VH, false, 1.25);
    const conExtra = pagoDia(d, VH, true, 1.25);
    expect(conExtra - sinExtra).toBeCloseTo(15, 2);
    expect(resumenTarifaEspecial(d, true)).toMatchObject({ horasEspecialesH: 4, ganadoEspecial: 60 });
  });
});

describe('feriado con recargo y tarifa especial (solo aplica la tarifa especial)', () => {
  it('con tarifa especial, el recargo ×2 del feriado no se aplica ese día', () => {
    const d = { ...aplicarTarifaEspecial(diaConTurno([m('ENTRADA', 18 * 60), m('SALIDA', 22 * 60)]), [regla()]), recargo: 2 };
    expect(pagoTrabajadoDia(d, VH)).toBeCloseTo(VH + 45, 2);
  });
  it('sin tarifa especial, el mismo feriado sí paga ×2 (como antes)', () => {
    const d = { ...diaConTurno([m('ENTRADA', 18 * 60), m('SALIDA', 22 * 60)]), recargo: 2 };
    expect(pagoTrabajadoDia(d, VH)).toBeCloseTo(4 * VH * 2, 2);
  });
});

describe('descanso trabajado con tarifa especial (sin horario, entrada 16:00 y salida 21:00)', () => {
  const descanso = () => calcularDiaPlanilla({ jornada: DOMINGO, estado: 'A_REVISAR', turno: null, marcas: [m('ENTRADA', 16 * 60), m('SALIDA', 21 * 60)] }, TOL);

  it('antes de las 19:00 a valor hora normal; desde las 19:00 a la tarifa especial', () => {
    const d = aplicarTarifaEspecial(descanso(), [regla()]);
    // 180 min normales (sin el 1,25) + 120 min especiales
    expect(pagoDia(d, VH, true, 1.25)).toBeCloseTo((180 / 60) * VH + 30, 2);
  });
  it('sin aprobar la extra no se paga nada del descanso', () => {
    const d = aplicarTarifaEspecial(descanso(), [regla()]);
    expect(pagoDia(d, VH, false, 1.25)).toBeCloseTo(0, 2);
  });
  it('resumen: 2 h especiales solo cuando está aprobada', () => {
    const d = aplicarTarifaEspecial(descanso(), [regla()]);
    expect(resumenTarifaEspecial(d, true)).toMatchObject({ horasEspecialesH: 2, ganadoEspecial: 30 });
    expect(resumenTarifaEspecial(d, false)).toMatchObject({ horasEspecialesH: 0, ganadoEspecial: 0 });
  });
});

describe('reglas que no aplican', () => {
  const trabajado = () => diaConTurno([m('ENTRADA', 18 * 60), m('SALIDA', 22 * 60)]);
  it('día sin regla: igual que antes (mismo pago, sin insignia)', () => {
    const d = trabajado();
    const otroDia = aplicarTarifaEspecial({ ...d, jornada: '2026-11-16' }, [regla()]); // lunes
    expect(otroDia.tarifaEspecial).toBeUndefined();
    expect(pagoDia(otroDia, VH, false)).toBeCloseTo(4 * VH, 2);
  });
  it('regla fuera de vigencia (empieza después): no aplica', () => {
    const d = aplicarTarifaEspecial(trabajado(), [regla({ vigenteDesde: '2026-11-22' })]);
    expect(d.tarifaEspecial).toBeUndefined();
    expect(pagoDia(d, VH, false)).toBeCloseTo(4 * VH, 2);
  });
  it('regla que ya terminó: no aplica', () => {
    expect(reglaTarifaDelDia([regla({ vigenteHasta: '2026-11-08' })], DOMINGO)).toBeNull();
  });
  it('regla con fin incluido: aplica el último día y no el siguiente', () => {
    const r = regla({ vigenteHasta: DOMINGO });
    expect(reglaTarifaDelDia([r], DOMINGO)).toEqual(r);
    expect(reglaTarifaDelDia([r], '2026-11-22')).toBeNull();
  });
  it('regla desactivada: no aplica', () => {
    const d = aplicarTarifaEspecial(trabajado(), [regla({ activa: false })]);
    expect(d.tarifaEspecial).toBeUndefined();
  });
  it('en vacaciones no se aplica', () => {
    const d = aplicarTarifaEspecial({ ...trabajado(), estado: 'VACACIONES' }, [regla()]);
    expect(d.tarifaEspecial).toBeUndefined();
  });
});

describe('validarReglaTarifa', () => {
  const nueva = (over: Partial<ReglaTarifaEspecial> = {}) => regla({ vigenteDesde: '2026-11-15', ...over });
  it('acepta una regla válida sin otras reglas', () => {
    expect(validarReglaTarifa(nueva(), [])).toBeNull();
  });
  it('rechaza tarifa <= 0, día fuera de 0-6, hora fuera de 0-1439 y fin antes de inicio', () => {
    expect(validarReglaTarifa(nueva({ tarifaHora: 0 }), [])).not.toBeNull();
    expect(validarReglaTarifa(nueva({ diaSemana: 7 }), [])).not.toBeNull();
    expect(validarReglaTarifa(nueva({ desdeMin: 1440 }), [])).not.toBeNull();
    expect(validarReglaTarifa(nueva({ vigenteHasta: '2026-11-01' }), [])).not.toBeNull();
  });
  it('rechaza solapar una regla activa del mismo día con vigencias que se cruzan', () => {
    const otra = { diaSemana: 0, vigenteDesde: '2026-11-01', vigenteHasta: '2026-12-31' };
    expect(validarReglaTarifa(nueva(), [otra])).not.toBeNull();
    expect(validarReglaTarifa(nueva({ vigenteHasta: null }), [{ diaSemana: 0, vigenteDesde: '2026-11-01', vigenteHasta: '2026-11-14' }])).toBeNull();
  });
  it('permite otro día de la semana con las mismas fechas', () => {
    const otra = { diaSemana: 6, vigenteDesde: '2026-11-01', vigenteHasta: null };
    expect(validarReglaTarifa(nueva(), [otra])).toBeNull();
  });
  it('una regla inactiva no choca con otras', () => {
    const otra = { diaSemana: 0, vigenteDesde: '2026-11-01', vigenteHasta: null };
    expect(validarReglaTarifa(nueva({ activa: false }), [otra])).toBeNull();
  });
});
