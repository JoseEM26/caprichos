import { describe, it, expect } from 'vitest';
import { destinoTrasIngresar } from '../destinoTrasIngresar';

describe('destinoTrasIngresar', () => {
  it('vuelve a una ruta interna del panel', () => {
    expect(destinoTrasIngresar('/admin/mi-asistencia')).toBe('/admin/mi-asistencia');
    expect(destinoTrasIngresar('/admin/repartos')).toBe('/admin/repartos');
  });
  it('nunca sale del panel ni a URLs externas', () => {
    expect(destinoTrasIngresar('https://evil.example')).toBe('/admin');
    expect(destinoTrasIngresar('//evil.example/admin')).toBe('/admin');
    expect(destinoTrasIngresar('/pedidos')).toBe('/admin');
    expect(destinoTrasIngresar('/administracion')).toBe('/admin');
  });
  it('sin retorno o sin texto cae en /admin, y no vuelve a la pantalla de ingreso', () => {
    expect(destinoTrasIngresar(undefined)).toBe('/admin');
    expect(destinoTrasIngresar(null)).toBe('/admin');
    expect(destinoTrasIngresar('/admin/ingresar')).toBe('/admin');
  });
});
