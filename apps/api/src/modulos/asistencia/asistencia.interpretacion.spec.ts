import { MarcaCalc, calcularJornada, evaluarJornada, turnoDe } from './asistencia.calculo';
import { detectarInconsistencia, interpretarMarcas, rolEfectivo } from './asistencia.interpretacion';
import { calcularDiaPlanilla } from './planilla.calculo';

const m = (h: number, min = 0) => h * 60 + min;
const g = (...mins: number[]): MarcaCalc[] => mins.map((minutos, i) => ({ id: i + 1, tipo: 'ENTRADA', minutos, estado: 'VALIDA' }));
const turno = turnoDe(m(9), m(18), m(13), m(14));
const sinBreak = turnoDe(m(9), m(18));
const roles = (r: ReturnType<typeof interpretarMarcas>) => r.marcas.map((x) => x.rol);

describe('interpretarMarcas: orden y pares', () => {
  it('4 marcas normales: entrada, salida a break, regreso y salida; paga solo fuera del break', () => {
    const r = interpretarMarcas(g(m(9), m(13), m(13, 40), m(18)), turno, true);
    expect(roles(r)).toEqual(['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA']);
    expect(r.estado).toBe('OK');
    expect(r.breakMin).toBe(40);
    expect(r.tramos).toEqual([
      { desde: m(9), hasta: m(13), tipo: 'TRABAJO' },
      { desde: m(13), hasta: m(13, 40), tipo: 'BREAK' },
      { desde: m(13, 40), hasta: m(18), tipo: 'TRABAJO' },
    ]);
  });

  it('3 marcas con jornada cerrada: A_REVISAR, «falta el regreso del break»', () => {
    const r = interpretarMarcas(g(m(9), m(13), m(18)), turno, true);
    expect(r.estado).toBe('A_REVISAR');
    expect(r.alertas).toEqual(['Marcó 3 veces: falta el regreso del break']);
    expect(r.faltan).toEqual(['ENTRADA_ALMUERZO']);
  });

  it('7 marcas (no cierran en pares): A_REVISAR', () => {
    const r = interpretarMarcas(g(m(9), m(11), m(12), m(13), m(14), m(15), m(18)), turno, true);
    expect(r.estado).toBe('A_REVISAR');
    expect(r.alertas[0]).toMatch(/^Marcó 7 veces/);
  });

  it('8 marcas que cierran en pares: OK, solo se descuentan los pares', () => {
    const r = interpretarMarcas(g(m(9), m(11), m(11, 15), m(13), m(13, 30), m(15), m(15, 10), m(18)), sinBreak, true);
    expect(r.estado).toBe('OK');
    expect(r.breaks).toHaveLength(3);
    expect(r.breakMin).toBe(15 + 30 + 10);
  });

  it('doble marca a 2 min: la primera cuenta y la otra queda tachada (no es salida ni break)', () => {
    const r = interpretarMarcas(g(m(9), m(9, 2), m(18)), sinBreak, true);
    expect(r.marcas[1]).toMatchObject({ rol: null, duplicadaDe: 0 });
    expect(rolEfectivo(r, r.marcas[1])).toBe('ENTRADA');
    expect(roles(r)).toEqual(['ENTRADA', null, 'SALIDA']);
    expect(r.estado).toBe('OK');
  });

  it('la doble marca «separada» por el admin cuenta como marca propia; el umbral es configurable', () => {
    const marcas = g(m(9), m(9, 2), m(18));
    marcas[1].separada = true;
    expect(interpretarMarcas(marcas, sinBreak, true).marcas[1].duplicadaDe).toBeNull();
    expect(interpretarMarcas(g(m(9), m(9, 2), m(18)), sinBreak, true, 0).marcas[1].duplicadaDe).toBeNull();
    expect(interpretarMarcas(g(m(9), m(9, 4), m(18)), sinBreak, true, 5).marcas[1].duplicadaDe).toBe(0);
  });

  it('jornada que cruza medianoche: la salida de madrugada (minutos > 1440) es la última marca', () => {
    const r = interpretarMarcas(g(m(22), m(26)), turnoDe(m(22), m(2)), true);
    expect(roles(r)).toEqual(['ENTRADA', 'SALIDA']);
    expect(r.estado).toBe('OK');
  });

  it('sin break programado y sin marcas de break: no se descuenta nada; con break programado y sin marcas, el programado', () => {
    expect(interpretarMarcas(g(m(9), m(18)), sinBreak, true).breakMin).toBe(0);
    expect(interpretarMarcas(g(m(9), m(18)), turno, true).breakMin).toBe(60);
  });

  it('1 sola marca: INCOMPLETO al cerrar el día y EN_CURSO mientras tanto', () => {
    expect(interpretarMarcas(g(m(9)), turno, true)).toMatchObject({ estado: 'INCOMPLETO', faltan: ['SALIDA'] });
    expect(interpretarMarcas(g(m(9)), turno, false).estado).toBe('EN_CURSO');
  });

  it('jornada abierta con 2 marcas a media jornada: está en su break (no es la salida)', () => {
    const r = interpretarMarcas(g(m(9), m(13)), turno, false);
    expect(roles(r)).toEqual(['ENTRADA', 'SALIDA_ALMUERZO']);
    expect(r.estado).toBe('EN_CURSO');
    expect(r.tramos[r.tramos.length - 1]).toEqual({ desde: m(13), hasta: null, tipo: 'BREAK' });
  });

  it('una marca fija (corrección del admin) conserva su rol y completa los pares', () => {
    const marcas = g(m(9), m(13), m(13, 40));
    marcas.push({ id: 9, tipo: 'SALIDA', minutos: m(18), estado: 'VALIDA', fijo: true, separada: true });
    const r = interpretarMarcas(marcas, turno, true);
    expect(roles(r)).toEqual(['ENTRADA', 'SALIDA_ALMUERZO', 'ENTRADA_ALMUERZO', 'SALIDA']);
    expect(r.estado).toBe('OK');
  });

  it('sin marcas: SIN_MARCAS', () => {
    expect(interpretarMarcas([], turno, true).estado).toBe('SIN_MARCAS');
  });
});

describe('una sola fuente de verdad: jornada y planilla usan la misma interpretación', () => {
  const ahora = new Date('2026-11-07T10:00:00Z'); // la jornada del 6 ya cerró
  it('jornada normal de 4 marcas: mismas cifras que antes (trabajada = salida - entrada - break real)', () => {
    const marcas = g(m(9), m(13), m(13, 40), m(18));
    const { resultado, interp } = evaluarJornada({ jornada: '2026-11-06', turno, marcas, ahora, tolerancia: 10 });
    expect(resultado.estado).toBe('CUMPLIO');
    expect(resultado.trabajadaMin).toBe(m(9) - 40);
    const dia = calcularDiaPlanilla(
      { jornada: '2026-11-06', estado: resultado.estado, turno, marcas: interp.marcas.filter((x) => x.rol).map((x) => ({ ...x, tipo: x.rol! })), breakMin: interp.breakMin },
      10,
    );
    expect(dia.trabajadaMin).toBe(m(9)); // la planilla paga el break
  });

  it('con 8 marcas la planilla paga los tres breaks (no se descuentan)', () => {
    const marcas = g(m(9), m(11), m(11, 15), m(13), m(13, 30), m(15), m(15, 10), m(18));
    const { resultado, interp } = evaluarJornada({ jornada: '2026-11-06', turno: sinBreak, marcas, ahora, tolerancia: 10 });
    expect(resultado.almuerzoMin).toBe(55);
    const dia = calcularDiaPlanilla(
      { jornada: '2026-11-06', estado: resultado.estado, turno: sinBreak, marcas: interp.marcas.filter((x) => x.rol).map((x) => ({ ...x, tipo: x.rol! })), breakMin: interp.breakMin },
      10,
    );
    expect(dia.trabajadaMin).toBe(m(9)); // los breaks se pagan: no se descuentan
  });

  it('una doble marca A_REVISAR (tachada) no bloquea la jornada', () => {
    const marcas = g(m(9), m(9, 1), m(18));
    marcas[1].estado = 'A_REVISAR';
    expect(calcularJornada({ jornada: '2026-11-06', turno: sinBreak, marcas, ahora, tolerancia: 10 }).estado).toBe('CUMPLIO');
  });
});

describe('detectarInconsistencia', () => {
  const ahora = new Date('2026-11-07T10:00:00Z');
  const evaluar = (marcas: MarcaCalc[]) => {
    const { resultado, interp } = evaluarJornada({ jornada: '2026-11-06', turno, marcas, ahora, tolerancia: 10 });
    return detectarInconsistencia(resultado.estado, interp, 'viernes 6');
  };

  it('entrada sin salida', () => expect(evaluar(g(m(9)))).toMatchObject({ tipo: 'SIN_SALIDA', falta: 'SALIDA', texto: 'No marcaste tu salida (viernes 6)' }));
  it('salida sin entrada', () => {
    const marcas: MarcaCalc[] = [{ id: 1, tipo: 'SALIDA', minutos: m(18), estado: 'VALIDA', fijo: true, separada: true }];
    expect(evaluar(marcas)).toMatchObject({ tipo: 'SIN_ENTRADA', falta: 'ENTRADA' });
  });
  it('break sin regreso', () => expect(evaluar(g(m(9), m(13), m(18)))).toMatchObject({ tipo: 'BREAK_SIN_REGRESO', falta: 'ENTRADA_ALMUERZO' }));
  it('marcas que no cuadran', () => expect(evaluar(g(m(9), m(11), m(12), m(13), m(14), m(15), m(18)))?.tipo).toBe('BREAK_SIN_REGRESO'));
  it('día con horario y cero marcas (posible falta)', () => expect(evaluar([])).toMatchObject({ tipo: 'SIN_MARCAS', falta: 'ENTRADA' }));
  it('jornada normal: sin inconsistencia', () => expect(evaluar(g(m(9), m(13), m(14), m(18)))).toBeNull());
  it('marca web pendiente del admin (orden correcto) no es culpa de la persona', () => {
    const marcas = g(m(9), m(18));
    marcas[0].estado = 'A_REVISAR';
    expect(evaluar(marcas)).toBeNull();
  });
});
