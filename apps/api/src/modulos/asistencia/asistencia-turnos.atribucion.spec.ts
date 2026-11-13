// La falta y el pago de un reemplazo salen del cálculo que ya usan la asistencia, el calendario y la planilla:
// resolverTurno (turno esperado) + evaluarJornada (estado y horas trabajadas; la planilla paga solo trabajadaMin).
import { evaluarJornada, resolverTurno, turnoDe } from './asistencia.calculo';

const m = (h: number, min = 0) => h * 60 + min;
const A = 1n; // pide el reemplazo (turno 09:00-17:00 los lunes)
const B = 2n; // cubre
const JORNADA = '2026-11-16'; // lunes
const DESPUES = new Date('2026-11-17T12:00:00Z'); // la jornada ya cerró
const horarios = [{ partyId: A, dia: 1, entrada: m(9), salida: m(17), almuerzoIni: m(13), almuerzoFin: m(14) }];
const ctx = (coberturas: any[]) => ({ horarios, coberturas, reemplazos: [] });
const cobTotal = { fecha: JORNADA, cubreId: B, reemplazaId: A, desde: m(9), hasta: m(17) };

const jornada = (partyId: bigint, c: any[], marcas: any[] = []) => {
  const { turno, motivoDescanso } = resolverTurno(partyId, JORNADA, ctx(c));
  return { turno, ...evaluarJornada({ jornada: JORNADA, turno, marcas, ahora: DESPUES, tolerancia: 5, motivoDescanso }).resultado };
};

describe('cobertura aprobada: de quién es la falta y quién cobra', () => {
  it('el reemplazo recibe el turno esperado y, sin marcas, es SU falta sin horas pagables', () => {
    const r = jornada(B, [cobTotal]);
    expect(r.turno).toEqual({ entrada: m(9), salida: m(17) });
    expect(r.estado).toBe('FALTA');
    expect(r.trabajadaMin).toBe(0); // planilla paga solo trabajadaMin
  });

  it('el solicitante cubierto no tiene turno: ni falta ni horas esperadas', () => {
    const r = jornada(A, [cobTotal]);
    expect(r.turno).toBeNull();
    expect(r.estado).toBe('DESCANSO');
    expect(r.programadaMin).toBe(0);
  });

  it('si el reemplazo sí marca, cumple y se le pagan sus horas', () => {
    const r = jornada(B, [cobTotal], [
      { tipo: 'ENTRADA', minutos: m(9), estado: 'VALIDA' },
      { tipo: 'SALIDA', minutos: m(17), estado: 'VALIDA' },
    ]);
    expect(r.estado).toBe('CUMPLIO');
    expect(r.trabajadaMin).toBe(480);
  });

  it('cobertura parcial (tarde): el solicitante conserva la mañana y el reemplazo solo la tarde', () => {
    const tarde = { fecha: JORNADA, cubreId: B, reemplazaId: A, desde: m(13), hasta: m(17) };
    expect(resolverTurno(A, JORNADA, ctx([tarde])).turno).toEqual(turnoDe(m(9), m(13)));
    expect(resolverTurno(B, JORNADA, ctx([tarde])).turno).toEqual(turnoDe(m(13), m(17)));
  });

  it('cobertura parcial (mañana): al solicitante le queda la tarde', () => {
    const manana = { fecha: JORNADA, cubreId: B, reemplazaId: A, desde: m(9), hasta: m(13) };
    expect(resolverTurno(A, JORNADA, ctx([manana])).turno).toEqual(turnoDe(m(13), m(17)));
  });

  it('cobertura total sigue dejando al solicitante sin turno (comportamiento anterior)', () => {
    expect(resolverTurno(A, JORNADA, ctx([cobTotal]))).toEqual({ turno: null, motivoDescanso: 'Cubierto por otra persona' });
  });
});
