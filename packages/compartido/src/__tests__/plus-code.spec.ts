import { describe, expect, it } from 'vitest';
import {
  codificarPlusCode,
  decodificarPlusCode,
  esPlusCodeCompleto,
  esPlusCodeCorto,
  esPlusCodeValido,
  plusCodeCorto,
  plusCodeDesdeTexto,
  plusCodeParaMostrar,
  recuperarPlusCode,
} from '../utilidades/plus-code.js';

describe('Plus Code (OLC)', () => {
  it('casos de la especificación', () => {
    expect(codificarPlusCode(20.3701125, 2.782234375, 11)).toBe('7FG49QCJ+2VX');
    expect(codificarPlusCode(20.3701125, 2.782234375, 10)).toBe('7FG49QCJ+2V');
    expect(codificarPlusCode(47.0000625, 8.0000625, 10)).toBe('8FVC2222+22');
    expect(codificarPlusCode(-41.2730625, 174.7859375, 10)).toBe('4VCPPQGP+Q9');
    expect(codificarPlusCode(90, 1, 10).startsWith('C')).toBe(true);
  });

  it('Lima: código corto y para mostrar', () => {
    const c = codificarPlusCode(-12.0464, -77.0428);
    expect(c).toMatch(/^57V4[2-9CFGHJMPQRVWX]{4}\+[2-9CFGHJMPQRVWX]{2}$/);
    expect(plusCodeCorto(-12.0464, -77.0428)).toBe(c.slice(4));
    expect(plusCodeParaMostrar(-12.0464, -77.0428)).toBe(`${c.slice(4)} Lima`);
    expect(plusCodeParaMostrar(40.4, -3.7)).toBe(codificarPlusCode(40.4, -3.7));
  });

  it('ida y vuelta: el área contiene el punto y recodificar el centro da el mismo código', () => {
    const puntos = [[-12.0464, -77.0428], [-12.1211, -77.0297], [-33.8688, 151.2093], [0, 0], [51.5, -0.12], [-89.9, 179.9]];
    for (const [lat, lng] of puntos) {
      for (const n of [10, 11, 13]) {
        const cod = codificarPlusCode(lat, lng, n);
        const a = decodificarPlusCode(cod)!;
        expect(lat).toBeGreaterThanOrEqual(a.latMin - 1e-9);
        expect(lat).toBeLessThanOrEqual(a.latMax + 1e-9);
        expect(lng).toBeGreaterThanOrEqual(a.lngMin - 1e-9);
        expect(lng).toBeLessThanOrEqual(a.lngMax + 1e-9);
        expect(codificarPlusCode(a.latCentro, a.lngCentro, n)).toBe(cod);
      }
    }
    const a = decodificarPlusCode('7FG49QCJ+2VX')!;
    expect(a.latCentro).toBeCloseTo(20.3701125, 6);
    expect(a.lngCentro).toBeCloseTo(2.782234375, 6);
  });

  it('validez', () => {
    expect(esPlusCodeValido('7FG49QCJ+2VX')).toBe(true);
    expect(esPlusCodeValido('7fg49qcj+2vx')).toBe(true);
    expect(esPlusCodeCorto('9QCJ+2VX')).toBe(true);
    expect(esPlusCodeCompleto('9QCJ+2VX')).toBe(false);
    expect(esPlusCodeValido('7FG49QCJ+2')).toBe(false);
    expect(esPlusCodeValido('7FG49QCJ2VX')).toBe(false);
    expect(esPlusCodeValido('7FG49QCJ+2VA')).toBe(false);
    expect(esPlusCodeValido('ZZZZZZZZ+22')).toBe(false);
    expect(decodificarPlusCode('9QCJ+2VX')).toBeNull();
  });

  it('recupera un código corto con referencia', () => {
    expect(recuperarPlusCode('9QCJ+2VX', 20.3701, 2.7822)).toBe('7FG49QCJ+2VX');
    const c = codificarPlusCode(-12.1, -77.03);
    expect(recuperarPlusCode(c.slice(4), -12.0464, -77.0428)).toBe(c);
  });

  it('desde texto: completo o corto con Lima; corto solo se ignora', () => {
    const c = codificarPlusCode(-12.1, -77.03);
    const a = plusCodeDesdeTexto(`mi casa es ${c} gracias`)!;
    expect(a.codigo).toBe(c);
    expect(a.lat).toBeCloseTo(-12.1, 3);
    expect(plusCodeDesdeTexto(`${c.slice(4)} Lima`)!.codigo).toBe(c);
    expect(plusCodeDesdeTexto(c.slice(4))).toBeNull();
    expect(plusCodeDesdeTexto(`${c.slice(4)} Madrid`)).toBeNull();
    expect(plusCodeDesdeTexto('7FG49QCJ+2VX')).toBeNull();
    expect(plusCodeDesdeTexto('hola, quiero 2 donas')).toBeNull();
  });
});
