import { describe, it, expect } from 'vitest';
import { anchoPcExcedeCabezal, tamanoPcValido, ANCHO_CABEZAL_MM } from '../index';

describe('ancho que cruza el cabezal de la etiquetera', () => {
  it('apaisado: el lado largo es el ancho que cruza el cabezal', () => {
    expect(anchoPcExcedeCabezal({ anchoMm: 115, altoMm: 59.8, orientacion: 'apaisado' })).toBe(true);
    expect(anchoPcExcedeCabezal({ anchoMm: 104, altoMm: 59.8, orientacion: 'apaisado' })).toBe(false);
  });
  it('vertical: el lado corto es el ancho; el alto puede pasar de 104', () => {
    expect(anchoPcExcedeCabezal({ anchoMm: 59.8, altoMm: 115, orientacion: 'vertical' })).toBe(false);
    expect(anchoPcExcedeCabezal({ anchoMm: 115, altoMm: 59.8, orientacion: 'vertical' })).toBe(false);
  });
  it('sin orientacion: el ancho guardado', () => {
    expect(anchoPcExcedeCabezal({ anchoMm: 115, altoMm: 59.8 })).toBe(true);
    expect(tamanoPcValido({ anchoMm: 115, altoMm: 59.8 })).not.toBeNull();
    expect(ANCHO_CABEZAL_MM).toBe(104);
  });
});
