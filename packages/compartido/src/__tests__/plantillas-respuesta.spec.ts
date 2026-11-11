import { describe, it, expect } from 'vitest';
import { marcadoresPendientes, resolverPlantilla } from '../utilidades/plantillas-respuesta.js';

describe('resolverPlantilla', () => {
  it('reemplaza las variables con dato', () => {
    const r = resolverPlantilla('Hola {{nombre}}, soy {{ mi_nombre }}.', { nombre: 'Ana', mi_nombre: 'Luis' });
    expect(r).toEqual({ texto: 'Hola Ana, soy Luis.', faltantes: [] });
  });
  it('deja visible el marcador sin dato y lo avisa una sola vez', () => {
    const r = resolverPlantilla('{{nombre}} y {{nombre}} en {{local}}', { nombre: '  ', local: 'Café' });
    expect(r.texto).toBe('{{nombre}} y {{nombre}} en Café');
    expect(r.faltantes).toEqual(['nombre']);
  });
  it('variable desconocida queda pendiente', () => {
    expect(resolverPlantilla('{{raro}}', {}).faltantes).toEqual(['raro']);
  });
  it('lista los marcadores pendientes', () => {
    expect(marcadoresPendientes('a {{x}} b {{y}} {{x}}')).toEqual(['x', 'y']);
    expect(marcadoresPendientes('sin nada')).toEqual([]);
  });
});
