import { describe, it, expect } from 'vitest';
import { paramsClientes } from '../clientesApi';

describe('paramsClientes: alcance del sorteo y la lista', () => {
  it('«todos» no manda parámetro; «registrados» y «hoy» sí viajan', () => {
    expect(paramsClientes({ alcance: 'todos' }).has('alcance')).toBe(false);
    expect(paramsClientes({ alcance: 'registrados' }).get('alcance')).toBe('registrados');
    expect(paramsClientes({ alcance: 'hoy' }).get('alcance')).toBe('hoy');
  });
});
