import { describe, expect, it } from 'vitest';
import { cuando, textoApertura } from '../ProgramarPedido';

describe('programar fuera de horario: cuándo abrimos', () => {
  const dias = [{ fecha: '2027-03-01', abre: '15:00', horas: [{ hora: '15:00', iso: '2027-03-01T20:00:00.000Z' }] }];
  it('hoy más tarde (antes de abrir): «Abrimos hoy a las 15:00»', () => {
    expect(textoApertura({ diasMax: 7, hoy: '2027-03-01', dias })).toContain('Abrimos hoy a las 15:00');
  });
  it('si el primer día es mañana lo dice, y un día lejano usa la fecha', () => {
    expect(cuando('2027-03-02', '2027-03-01')).toBe('mañana');
    expect(cuando('2027-03-05', '2027-03-01')).toMatch(/viernes 5 de marzo/);
  });
  it('sin datos no inventa nada', () => {
    expect(textoApertura(null)).toBe('');
    expect(textoApertura({ diasMax: 7, dias: [{ fecha: '2027-03-01', horas: [] }] })).toBe('');
  });
});
