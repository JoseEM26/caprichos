import { describe, it, expect } from 'vitest';
import { errorParaCuando, programadoParaIso, textoProgramado, PARA_CUANDO_AHORA, type ParaCuando } from '../componentes/paraCuando';

// 13/11/2026 10:00 en Lima
const ahora = new Date('2026-11-13T15:00:00.000Z');

describe('paraCuando', () => {
  it('Ahora no programa nada y no tiene errores', () => {
    expect(programadoParaIso(PARA_CUANDO_AHORA, ahora)).toBeNull();
    expect(errorParaCuando(PARA_CUANDO_AHORA, ahora)).toBeNull();
  });

  it('Mañana usa el día siguiente a hoy (Lima) con la hora elegida', () => {
    const v: ParaCuando = { modo: 'MANANA', fecha: '', hora: '08:30' };
    expect(programadoParaIso(v, ahora)).toBe('2026-11-14T13:30:00.000Z');
    expect(errorParaCuando(v, ahora)).toBeNull();
  });

  it('otra fecha pide fecha y hora, no admite el pasado ni pasar el tope de días', () => {
    expect(errorParaCuando({ modo: 'OTRA', fecha: '', hora: '08:00' }, ahora)).toMatch(/fecha/i);
    expect(errorParaCuando({ modo: 'MANANA', fecha: '', hora: '' }, ahora)).toMatch(/hora/i);
    expect(errorParaCuando({ modo: 'OTRA', fecha: '2026-11-13', hora: '09:00' }, ahora)).toMatch(/pasó/);
    expect(errorParaCuando({ modo: 'OTRA', fecha: '2026-11-20', hora: '09:00' }, ahora)).toBeNull();
    expect(errorParaCuando({ modo: 'OTRA', fecha: '2026-11-21', hora: '09:00' }, ahora)).toMatch(/7 días/);
  });

  it('el texto de la hora pactada sale en hora de Lima', () => {
    expect(textoProgramado('2026-11-14T13:30:00.000Z')).toContain('08:30');
    expect(textoProgramado(null)).toBe('');
  });
});
