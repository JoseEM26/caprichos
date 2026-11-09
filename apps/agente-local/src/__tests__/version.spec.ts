import { describe, it, expect } from 'vitest';
import { LINEA_VERSION, VERSION_AGENTE, VERSION_NUMERO, obtenerConfiguracion } from '../config';

describe('versión del programa', () => {
  it('sin compilar por el workflow vale el valor de desarrollo', () => {
    expect(VERSION_NUMERO).toBe('0.1.0-dev');
    expect(VERSION_AGENTE).toBe('0.1.0-dev');
    expect(LINEA_VERSION).toBe('Programa de impresión Caprichos v0.1.0-dev (dev)');
  });

  it('el latido envía la versión', () => {
    expect(obtenerConfiguracion({}).version).toBe(VERSION_AGENTE);
  });
});
