import {
  CoberturaDia,
  PersonaTurno,
  elegirDestinatarios,
  enVentana,
  momentoLima,
} from '../destinatarios.util';

// Lunes 2026-11-02 (dia 1). Lima = UTC-5.
const LUNES_10H = { fecha: '2026-11-02', dia: 1, minuto: 10 * 60 };
const LUNES_22H = { fecha: '2026-11-02', dia: 1, minuto: 22 * 60 };

const persona = (id: string, extra: Partial<PersonaTurno> = {}): PersonaTurno => ({
  partyId: id,
  conCasilla: true,
  h247: false,
  horarios: [],
  fijos: [],
  ...extra,
});

describe('elegirDestinatarios (horario y casilla)', () => {
  it('manda a quien tiene casilla y trabaja en este momento; no a quien no trabaja', () => {
    const personas = [
      persona('1', { horarios: [{ dia: 1, entrada: 9 * 60, salida: 13 * 60 }] }),
      persona('2', { horarios: [{ dia: 1, entrada: 14 * 60, salida: 18 * 60 }] }),
    ];
    expect(elegirDestinatarios(LUNES_10H, personas, [])).toEqual(['1']);
  });

  it('no manda a quien tiene horario pero sin casilla', () => {
    const personas = [persona('1', { conCasilla: false, horarios: [{ dia: 1, entrada: 9 * 60, salida: 13 * 60 }] })];
    expect(elegirDestinatarios(LUNES_10H, personas, [])).toEqual([]);
  });

  it('el turno que cruza la medianoche cuenta en las dos mitades', () => {
    const personas = [persona('1', { horarios: [{ dia: 1, entrada: 20 * 60, salida: 2 * 60 }] })];
    expect(elegirDestinatarios({ ...LUNES_22H }, personas, [])).toEqual(['1']);
    expect(elegirDestinatarios({ fecha: '2026-11-03', dia: 2, minuto: 60 }, personas, [])).toEqual([]);
    expect(enVentana(60, 20 * 60, 2 * 60)).toBe(true);
    expect(enVentana(3 * 60, 20 * 60, 2 * 60)).toBe(false);
  });

  it('24/7 recibe solo si nadie con casilla está de turno', () => {
    const personas = [
      persona('admin', { h247: true }),
      persona('cajero', { horarios: [{ dia: 1, entrada: 9 * 60, salida: 13 * 60 }] }),
    ];
    // A las 10 trabaja el cajero: el 24/7 no recibe
    expect(elegirDestinatarios(LUNES_10H, personas, [])).toEqual(['cajero']);
    // A las 22 nadie trabaja: recibe el 24/7
    expect(elegirDestinatarios(LUNES_22H, personas, [])).toEqual(['admin']);
  });

  it('sin nadie de turno ni 24/7 devuelve vacío', () => {
    const personas = [persona('1', { horarios: [{ dia: 1, entrada: 9 * 60, salida: 13 * 60 }] })];
    expect(elegirDestinatarios(LUNES_22H, personas, [])).toEqual([]);
  });

  it('la cobertura del día reemplaza a la persona y pone en turno a quien cubre', () => {
    const personas = [
      persona('titular', { horarios: [{ dia: 1, entrada: 9 * 60, salida: 18 * 60 }] }),
      persona('suplente', { horarios: [] }),
    ];
    const coberturas: CoberturaDia[] = [{ cubreId: 'suplente', reemplazaId: 'titular', desde: 9 * 60, hasta: 14 * 60 }];
    expect(elegirDestinatarios(LUNES_10H, personas, coberturas)).toEqual(['suplente']);
  });

  it('fuera de la ventana de cobertura vuelve el titular', () => {
    const personas = [
      persona('titular', { horarios: [{ dia: 1, entrada: 9 * 60, salida: 18 * 60 }] }),
      persona('suplente'),
    ];
    const coberturas: CoberturaDia[] = [{ cubreId: 'suplente', reemplazaId: 'titular', desde: 9 * 60, hasta: 12 * 60 }];
    expect(elegirDestinatarios(LUNES_10H, personas, [])).toEqual(['titular']);
    expect(elegirDestinatarios({ fecha: '2026-11-02', dia: 1, minuto: 13 * 60 }, personas, coberturas)).toEqual(['titular']);
  });

  it('si no trabaja hoy y tiene reemplazo fijo, recibe quien lo reemplaza (si tiene casilla)', () => {
    const personas = [
      persona('libre', { conCasilla: false, fijos: [{ dia: 1, reemplazaId: 'reemplazo' }] }),
      persona('reemplazo'),
    ];
    expect(elegirDestinatarios(LUNES_10H, personas, [])).toEqual(['reemplazo']);
  });

  it('momentoLima calcula día y minuto en hora de Lima', () => {
    // 2026-11-02 15:30 UTC = 10:30 en Lima, lunes
    expect(momentoLima(new Date('2026-11-02T15:30:00Z'))).toEqual({ fecha: '2026-11-02', dia: 1, minuto: 630 });
  });
});
