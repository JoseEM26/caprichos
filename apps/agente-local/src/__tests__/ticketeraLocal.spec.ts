import { describe, it, expect } from 'vitest';
import { candidatasDeWindows, sugerirRol } from '../candidatas';

describe('ticketera del local (driver 3nStar POS-80)', () => {
  it('reconoce POS-80 y POS-80C como ticketera, antes que cualquier otra regla', () => {
    expect(sugerirRol('POS-80')).toBe('TICKETERA');
    expect(sugerirRol('POS-80C')).toBe('TICKETERA');
    expect(sugerirRol('POS80 label')).toBe('TICKETERA');
  });
  it('la pone primera en la lista', () => {
    const l = candidatasDeWindows([
      { nombre: '4BARCODE 4B-2054TH', driver: 'TSC' },
      { nombre: 'POS-80', driver: 'POS-80' },
    ]);
    expect(l[0].nombre).toBe('POS-80');
    expect(l[0].sugerido).toBe('TICKETERA');
    expect(l[1].sugerido).toBe('ETIQUETERA');
  });
});
