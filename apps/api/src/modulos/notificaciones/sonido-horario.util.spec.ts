jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
import { sonidoPorHorario } from './sonido-horario.util';

const base = { esAdmin: false, h247: false, horarios: [], coberturas: [] };
const lun = (minuto: number) => ({ fecha: '2026-11-09', dia: 1, minuto });
const h = (dia: number, entrada: number, salida: number) => ({ dia, entrada, salida });

describe('sonidoPorHorario', () => {
  it('ADMIN, 24/7 y sin horario suenan siempre', () => {
    expect(sonidoPorHorario(lun(0), { ...base, esAdmin: true, horarios: [h(1, 800, 900)] }).suenaAhora).toBe(true);
    expect(sonidoPorHorario(lun(0), { ...base, h247: true, horarios: [h(1, 800, 900)] }).suenaAhora).toBe(true);
    expect(sonidoPorHorario(lun(0), base).suenaAhora).toBe(true);
  });
  it('dentro suena; fuera no y dice el horario', () => {
    const d = { ...base, horarios: [h(1, 810, 1350)] };
    expect(sonidoPorHorario(lun(900), d).suenaAhora).toBe(true);
    const fuera = sonidoPorHorario(lun(1400), d);
    expect(fuera).toEqual({ suenaAhora: false, texto: 'Sonido en pausa: fuera de tu horario (13:30–22:30)' });
  });
  it('hoy sin turno', () => {
    const r = sonidoPorHorario(lun(900), { ...base, horarios: [h(2, 810, 1350)] });
    expect(r).toEqual({ suenaAhora: false, texto: 'Hoy no tienes turno: sonido en pausa' });
  });
  it('cruce de medianoche: noche de hoy y madrugada del día siguiente', () => {
    const d = { ...base, horarios: [h(0, 1320, 120)] }; // domingo 22:00-02:00
    expect(sonidoPorHorario({ fecha: '2026-11-08', dia: 0, minuto: 1380 }, d).suenaAhora).toBe(true);
    expect(sonidoPorHorario(lun(60), d).suenaAhora).toBe(true);
    expect(sonidoPorHorario(lun(180), d).suenaAhora).toBe(false);
    expect(sonidoPorHorario({ fecha: '2026-11-08', dia: 0, minuto: 60 }, d).suenaAhora).toBe(false);
  });
  it('cobertura activa hace sonar', () => {
    const d = { ...base, horarios: [h(2, 810, 1350)], coberturas: [{ desde: 600, hasta: 700 }] };
    expect(sonidoPorHorario(lun(650), d).suenaAhora).toBe(true);
    expect(sonidoPorHorario(lun(750), d).suenaAhora).toBe(false);
  });
});
