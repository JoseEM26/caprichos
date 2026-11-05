import { describe, it, expect } from 'vitest';
import { hoyLima, isoLima, partesLima } from '../fechaLima';

describe('fechaLima (zona America/Lima)', () => {
  it('19:00 Lima queda en el mismo día Lima', () => {
    expect(partesLima('2026-11-04T19:00:00-05:00')).toEqual({ fecha: '2026-11-04', hora: '19:00' });
  });

  it('23:30 Lima cae en el día siguiente en UTC pero sigue siendo el mismo día Lima', () => {
    const iso = '2026-11-04T23:30:00-05:00';
    expect(new Date(iso).toISOString().slice(0, 10)).toBe('2026-11-05');
    expect(partesLima(iso)).toEqual({ fecha: '2026-11-04', hora: '23:30' });
  });

  it('un instante en UTC se convierte a la hora de Lima', () => {
    expect(partesLima('2026-11-05T04:30:00.000Z')).toEqual({ fecha: '2026-11-04', hora: '23:30' });
  });

  it('isoLima arma el instante con -05:00 y hoyLima usa Lima', () => {
    expect(isoLima('2026-11-04', '23:30')).toBe('2026-11-04T23:30:00-05:00');
    // 2026-11-05 03:00 UTC = 2026-11-04 22:00 en Lima
    expect(hoyLima(new Date('2026-11-05T03:00:00.000Z'))).toBe('2026-11-04');
  });

  it('vacío si la fecha no es válida', () => {
    expect(partesLima('no es fecha')).toEqual({ fecha: '', hora: '' });
    expect(partesLima(null)).toEqual({ fecha: '', hora: '' });
  });
});
