import { coincideTexto, normalizarBusqueda } from '../normalizar-busqueda';

describe('normalizarBusqueda (servidor)', () => {
  it('ignora tildes, mayúsculas, guiones y espacios', () => {
    expect(normalizarBusqueda(' José  PEÑA ')).toBe('josepena');
    expect(normalizarBusqueda(undefined)).toBe('');
  });
  it('jose encuentra José y Peña', () => {
    expect(coincideTexto('jose', 'José Quispe')).toBe(true);
    expect(coincideTexto('pena', null, 'Peña')).toBe(true);
    expect(coincideTexto('', 'x')).toBe(true);
    expect(coincideTexto('zzz', 'José')).toBe(false);
  });
});
