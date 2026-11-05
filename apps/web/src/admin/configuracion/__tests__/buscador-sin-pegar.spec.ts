import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/** El buscador de Configuración se desplaza con el contenido: su regla CSS no puede ser sticky ni fixed. */
describe('buscador de Configuración', () => {
  const css = readFileSync(resolve(__dirname, '../configuracion-nav.css'), 'utf8');
  const regla = css.match(/\.cfg-buscador\s*\{([^}]*)\}/)?.[1] ?? '';

  it('la barra de búsqueda no es sticky ni fixed', () => {
    expect(regla).not.toMatch(/position\s*:\s*(sticky|fixed)/);
    expect(regla).toMatch(/position\s*:\s*(relative|static)/);
  });

  it('no queda ninguna regla sticky sobre el buscador en la hoja de Configuración', () => {
    expect(css).not.toMatch(/\.cfg-buscador[^{]*\{[^}]*position\s*:\s*sticky/);
  });
});
