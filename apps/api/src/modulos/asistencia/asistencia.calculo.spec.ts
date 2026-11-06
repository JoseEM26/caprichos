import {
  calcularJornada,
  distanciaMetros,
  jornadaDe,
  marcaPendiente,
  marcasPermitidas,
  motivoNoPermitida,
  resolverTurno,
  turnoDe,
  TipoMarca,
} from './asistencia.calculo';

const m = (h: number, min = 0) => h * 60 + min;
const JORNADA = '2026-11-06'; // viernes
// Hora de reloj de Lima (UTC-5) del 6 de noviembre; admite horas >= 24 (día siguiente)
const T = (h: number, min = 0) => new Date(Date.parse('2026-11-06T00:00:00Z') + (h * 60 + min + 300) * 60_000);
const turno9a18 = turnoDe(m(9), m(18));
const ahoraDespues = T(29, 0); // 05:00 del 7 de noviembre: la jornada del 6 ya cerró (04:00)
const ahoraDuranteDia = T(12, 0);

const marca = (tipo: TipoMarca, minutos: number, estado: 'VALIDA' | 'A_REVISAR' = 'VALIDA') => ({ tipo, minutos, estado });

describe('jornadaDe (America/Lima, cierre 04:00)', () => {
  it('una marca a las 22:30 Lima cae en su propio día', () => {
    expect(jornadaDe(T(22, 30))).toEqual({ jornada: JORNADA, minutos: m(22, 30) });
  });

  it('una marca a la 01:10 del día siguiente sigue siendo de la jornada anterior (turno que cruza medianoche)', () => {
    const r = jornadaDe(new Date('2026-11-07T06:10:00Z')); // 01:10 Lima del 7
    expect(r).toEqual({ jornada: JORNADA, minutos: m(25, 10) });
  });
});

describe('distanciaMetros (Haversine)', () => {
  it('dos puntos a ~0.00009 grados de latitud distan unos 10 m', () => {
    const d = distanciaMetros(-12.0464, -77.0428, -12.04631, -77.0428);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11);
  });

  it('el mismo punto da 0', () => {
    expect(distanciaMetros(-12.0464, -77.0428, -12.0464, -77.0428)).toBe(0);
  });
});

describe('calcularJornada (cumplimiento)', () => {
  const base = { jornada: JORNADA, turno: turno9a18, ahora: ahoraDespues, tolerancia: 10 };

  it('CUMPLIO con entrada y salida a tiempo', () => {
    const r = calcularJornada({ ...base, marcas: [marca('ENTRADA', m(9, 2)), marca('SALIDA', m(18, 1))] });
    expect(r.estado).toBe('CUMPLIO');
    expect(r.trabajadaMin).toBe(m(18, 1) - m(9, 2));
  });

  it('TARDANZA con 15 min tarde y tolerancia de 10; con tolerancia 20 vuelve a CUMPLIO', () => {
    const marcas = [marca('ENTRADA', m(9, 15)), marca('SALIDA', m(18))];
    expect(calcularJornada({ ...base, marcas }).estado).toBe('TARDANZA');
    expect(calcularJornada({ ...base, marcas }).tardanzaMin).toBe(15);
    expect(calcularJornada({ ...base, tolerancia: 20, marcas }).estado).toBe('CUMPLIO');
  });

  it('SALIO_ANTES cuando la salida es 30 min antes', () => {
    const r = calcularJornada({ ...base, marcas: [marca('ENTRADA', m(9)), marca('SALIDA', m(17, 30))] });
    expect(r.estado).toBe('SALIO_ANTES');
    expect(r.salioAntesMin).toBe(30);
  });

  it('SALIO_DESPUES con horas extra por encima de la tolerancia', () => {
    const r = calcularJornada({ ...base, marcas: [marca('ENTRADA', m(9)), marca('SALIDA', m(19, 0))] });
    expect(r.estado).toBe('SALIO_DESPUES');
    expect(r.extraMin).toBe(60);
  });

  it('FALTA: sin marcas y el día ya cerró', () => {
    expect(calcularJornada({ ...base, marcas: [] }).estado).toBe('FALTA');
  });

  it('SIN_EVALUAR: sin marcas y el día todavía no cierra', () => {
    expect(calcularJornada({ ...base, ahora: ahoraDuranteDia, marcas: [] }).estado).toBe('SIN_EVALUAR');
  });

  it('DESCANSO si no tiene turno y no marcó', () => {
    const r = calcularJornada({ ...base, turno: null, marcas: [], motivoDescanso: 'Cubierto por otra persona' });
    expect(r.estado).toBe('DESCANSO');
    expect(r.alertas).toEqual(['Cubierto por otra persona']);
  });

  it('marcar en un día sin horario queda A_REVISAR', () => {
    expect(calcularJornada({ ...base, turno: null, marcas: [marca('ENTRADA', m(10))] }).estado).toBe('A_REVISAR');
  });

  it('INCOMPLETO si falta la salida y el día ya cerró; SIN_EVALUAR si aún no cierra', () => {
    const marcas = [marca('ENTRADA', m(9))];
    expect(calcularJornada({ ...base, marcas }).estado).toBe('INCOMPLETO');
    expect(calcularJornada({ ...base, ahora: ahoraDuranteDia, marcas }).estado).toBe('SIN_EVALUAR');
  });

  it('una marca pendiente de revisión manda sobre lo demás', () => {
    const marcas = [marca('ENTRADA', m(9, 30), 'A_REVISAR'), marca('SALIDA', m(18))];
    expect(calcularJornada({ ...base, marcas }).estado).toBe('A_REVISAR');
  });

  it('descuenta el almuerzo realmente tomado', () => {
    const t = turnoDe(m(9), m(18), m(13), m(14));
    const marcas = [marca('ENTRADA', m(9)), marca('SALIDA_ALMUERZO', m(13)), marca('ENTRADA_ALMUERZO', m(13, 40)), marca('SALIDA', m(18))];
    const r = calcularJornada({ ...base, turno: t, marcas });
    expect(r.almuerzoMin).toBe(40);
    expect(r.trabajadaMin).toBe(m(18) - m(9) - 40);
    expect(r.programadaMin).toBe(m(18) - m(9) - 60);
  });

  it('sin marcas de almuerzo descuenta el programado', () => {
    const t = turnoDe(m(9), m(18), m(13), m(14));
    const r = calcularJornada({ ...base, turno: t, marcas: [marca('ENTRADA', m(9)), marca('SALIDA', m(18))] });
    expect(r.almuerzoMin).toBe(60);
    expect(r.trabajadaMin).toBe(m(18) - m(9) - 60);
  });

  it('salida sin regreso de almuerzo es INCOMPLETO al cerrar el día', () => {
    const t = turnoDe(m(9), m(18), m(13), m(14));
    const marcas = [marca('ENTRADA', m(9)), marca('SALIDA_ALMUERZO', m(13)), marca('SALIDA', m(18))];
    expect(calcularJornada({ ...base, turno: t, marcas }).estado).toBe('INCOMPLETO');
  });

  it('un turno que cruza medianoche suma la salida al día siguiente', () => {
    const noche = turnoDe(m(22), m(2));
    const marcas = [marca('ENTRADA', m(22)), marca('SALIDA', m(26))]; // 02:00 del día siguiente
    const r = calcularJornada({ ...base, turno: noche, marcas });
    expect(r.estado).toBe('CUMPLIO');
    expect(r.programadaMin).toBe(240);
  });
});

describe('resolverTurno (cobertura, horario y reemplazo)', () => {
  const luis = 7n;
  const ana = 8n;
  const horario = { partyId: luis, dia: 5, entrada: m(9), salida: m(18), almuerzoIni: null, almuerzoFin: null };

  it('horario fijo del día', () => {
    expect(resolverTurno(luis, JORNADA, { horarios: [horario], coberturas: [], reemplazos: [] }).turno).toEqual(turnoDe(m(9), m(18)));
  });

  it('la cobertura por fecha tiene prioridad sobre el horario fijo', () => {
    const cob = [{ fecha: JORNADA, cubreId: ana, reemplazaId: luis, desde: m(10), hasta: m(16) }];
    expect(resolverTurno(ana, JORNADA, { horarios: [], coberturas: cob, reemplazos: [] }).turno).toEqual(turnoDe(m(10), m(16)));
    const quien = resolverTurno(luis, JORNADA, { horarios: [horario], coberturas: cob, reemplazos: [] });
    expect(quien.turno).toBeNull();
    expect(quien.motivoDescanso).toBe('Cubierto por otra persona');
  });

  it('el reemplazo fijo solo aplica si no hay horario propio ese día', () => {
    const rem = [{ partyId: luis, dia: 5, reemplazaId: ana }];
    expect(resolverTurno(luis, JORNADA, { horarios: [horario], coberturas: [], reemplazos: rem }).turno).toEqual(turnoDe(m(9), m(18)));
    expect(resolverTurno(luis, JORNADA, { horarios: [], coberturas: [], reemplazos: rem }).motivoDescanso).toBe('Reemplazado ese día');
  });
});

describe('orden de marcas', () => {
  const set = (...t: TipoMarca[]) => new Set(t);

  it('no permite salida sin entrada ni dos entradas', () => {
    expect(motivoNoPermitida('SALIDA', set())).toBe('Primero marca tu entrada');
    expect(motivoNoPermitida('ENTRADA', set('ENTRADA'))).toBe('Ya marcaste la entrada de hoy');
  });

  it('el almuerzo es opcional, pero el regreso exige la salida a almuerzo', () => {
    expect(motivoNoPermitida('SALIDA', set('ENTRADA'))).toBeNull();
    expect(motivoNoPermitida('ENTRADA_ALMUERZO', set('ENTRADA'))).toBe('Primero marca tu salida a almuerzo');
    expect(motivoNoPermitida('SALIDA', set('ENTRADA', 'SALIDA_ALMUERZO'))).toBe('Primero marca tu regreso de almuerzo');
  });

  it('marcasPermitidas y marcaPendiente siguen el orden', () => {
    expect(marcaPendiente(set())).toBe('ENTRADA');
    expect(marcaPendiente(set('ENTRADA'))).toBe('SALIDA');
    expect(marcasPermitidas(set('ENTRADA'))).toEqual(['SALIDA_ALMUERZO', 'SALIDA']);
    expect(marcaPendiente(set('ENTRADA', 'SALIDA'))).toBeNull();
  });
});
