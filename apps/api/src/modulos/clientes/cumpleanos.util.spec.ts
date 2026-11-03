import { BadRequestException } from '@nestjs/common';
import { exigirCumpleanos, parsearCumpleanos } from './cumpleanos.util';

describe('cumpleanos.util', () => {
  const hoy = new Date(2026, 10, 3); // 3 de noviembre de 2026

  it('acepta día y mes, con o sin año', () => {
    expect(parsearCumpleanos('14/03', hoy)).toEqual({ dia: 14, mes: 3 });
    expect(parsearCumpleanos('1995-03-14', hoy)).toEqual({ dia: 14, mes: 3 });
  });

  it('rechaza fechas que no existen (31/02, 30/02 o 29/02 en año no bisiesto)', () => {
    expect(parsearCumpleanos('31/02', hoy)).toBeNull();
    expect(parsearCumpleanos('1995-02-29', hoy)).toBeNull();
    expect(parsearCumpleanos('2024-02-29', hoy)).toEqual({ dia: 29, mes: 2 });
  });

  it('rechaza fecha futura y edad no razonable', () => {
    expect(parsearCumpleanos('2026-11-04', hoy)).toBeNull();
    expect(parsearCumpleanos('1800-01-01', hoy)).toBeNull();
    expect(parsearCumpleanos('basura', hoy)).toBeNull();
  });

  it('exigirCumpleanos lanza CUMPLEANOS_REQUERIDO si falta y FECHA_INVALIDA si no vale', () => {
    expect(() => exigirCumpleanos('', hoy)).toThrow(BadRequestException);
    expect(() => exigirCumpleanos(undefined, hoy)).toThrow(expect.objectContaining({ response: expect.objectContaining({ codigo: 'CUMPLEANOS_REQUERIDO' }) }));
    expect(() => exigirCumpleanos('2026-12-01', hoy)).toThrow(expect.objectContaining({ response: expect.objectContaining({ codigo: 'FECHA_INVALIDA' }) }));
    expect(exigirCumpleanos('03/11', hoy)).toEqual({ dia: 3, mes: 11 });
  });
});
