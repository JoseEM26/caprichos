import { describe, it, expect } from 'vitest';
import { celularAlEscribir } from '../celular';

describe('celularAlEscribir', () => {
  it('quita el +51 al pegar en vez de cortar el final', () => {
    expect(celularAlEscribir('+51 987 654 321')).toBe('987654321');
    expect(celularAlEscribir('+51987654321')).toBe('987654321');
    expect(celularAlEscribir('51987654321')).toBe('987654321');
    expect(celularAlEscribir('0051 987654321')).toBe('987654321');
  });
  it('deja igual lo que se escribe a mano', () => {
    expect(celularAlEscribir('9876')).toBe('9876');
    expect(celularAlEscribir('987 654 321')).toBe('987654321');
    expect(celularAlEscribir('9876543210')).toBe('987654321');
    expect(celularAlEscribir('')).toBe('');
  });
});
