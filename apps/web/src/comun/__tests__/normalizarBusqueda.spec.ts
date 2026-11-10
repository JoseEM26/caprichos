import { describe, expect, it } from 'vitest';
import { coincideTexto, normalizarBusqueda } from '../normalizarBusqueda';

describe('normalizarBusqueda', () => {
  it('ignora tildes, mayúsculas, guiones y espacios', () => {
    expect(normalizarBusqueda(' José  PEÑA ')).toBe('josepena');
    expect(normalizarBusqueda('CP-W021')).toBe(normalizarBusqueda('cp w021'));
    expect(normalizarBusqueda(null)).toBe('');
  });
  it('jose encuentra José y Peña', () => {
    expect(coincideTexto('jose', 'José Quispe')).toBe(true);
    expect(coincideTexto('pena', null, 'Peña')).toBe(true);
    expect(coincideTexto('', 'x')).toBe(true);
    expect(coincideTexto('zzz', 'José')).toBe(false);
  });
});
