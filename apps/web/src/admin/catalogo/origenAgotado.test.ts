import { describe, expect, it } from 'vitest';
import { textosOrigenAgotado } from './origenAgotado';

describe('textosOrigenAgotado', () => {
  it('AUTOMATICO: por stock, vuelve al reponer', () => {
    const t = textosOrigenAgotado('AUTOMATICO');
    expect(t.corto).toBe('Agotado por stock (vuelve al reponer)');
    expect(t.ayuda).toMatch(/saldo llegó a 0/);
  });
  it.each(['MANUAL', null, undefined])('%s: a mano, no vuelve solo', (o) => {
    const t = textosOrigenAgotado(o);
    expect(t.corto).toBe('Agotado a mano (no vuelve solo)');
    expect(t.ayuda).toMatch(/Cocina › Agotados/);
  });
});
