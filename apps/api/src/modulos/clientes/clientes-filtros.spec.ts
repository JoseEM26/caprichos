import 'reflect-metadata';
import { detalleCelularSorteo, mesLima, nombreParaSorteo, rangoPedidos } from './clientes-filtros';

describe('rangoPedidos (día de Lima, UTC-5)', () => {
  // Jueves 12/11/2026 22:30 en Lima = viernes 13/11 03:30 UTC
  const ahora = new Date('2026-11-13T03:30:00Z');

  it('sin periodo o «siempre»: sin rango', () => {
    expect(rangoPedidos({}, ahora)).toEqual({});
    expect(rangoPedidos({ periodo: 'siempre' }, ahora)).toEqual({});
  });
  it('hoy: desde las 00:00 de Lima del día de Lima (no del día UTC)', () => {
    expect(rangoPedidos({ periodo: 'hoy' }, ahora).desde).toEqual(new Date('2026-11-12T05:00:00.000Z'));
  });
  it('semana: desde el lunes; mes: desde el día 1', () => {
    expect(rangoPedidos({ periodo: 'semana' }, ahora).desde).toEqual(new Date('2026-11-09T05:00:00.000Z'));
    expect(rangoPedidos({ periodo: 'mes' }, ahora).desde).toEqual(new Date('2026-11-01T05:00:00.000Z'));
  });
  it('semana en domingo cuenta desde el lunes anterior', () => {
    expect(rangoPedidos({ periodo: 'semana' }, new Date('2026-11-15T17:00:00Z')).desde).toEqual(new Date('2026-11-09T05:00:00.000Z'));
  });
  it('fechas propias mandan sobre el periodo y el hasta incluye todo el día', () => {
    expect(rangoPedidos({ periodo: 'hoy', desde: '2026-10-01', hasta: '2026-10-31' }, ahora)).toEqual({
      desde: new Date('2026-10-01T05:00:00.000Z'),
      hasta: new Date('2026-11-01T04:59:59.999Z'),
    });
  });
  it('mes de Lima: 01/12 02:00 UTC todavía es noviembre', () => {
    expect(mesLima(new Date('2026-12-01T02:00:00Z'))).toBe(11);
  });
});

describe('datos del sorteo', () => {
  it('nombre e inicial, nunca el nombre completo', () => {
    expect(nombreParaSorteo('María García López')).toBe('María G.');
    expect(nombreParaSorteo('ana', 'quispe rojas')).toBe('ana Q.');
    expect(nombreParaSorteo('Luis')).toBe('Luis');
  });
  it('celular: solo los 3 últimos dígitos', () => {
    expect(detalleCelularSorteo('987654123')).toBe('···123');
    expect(detalleCelularSorteo('+51 987 654 123')).toBe('···123');
    expect(detalleCelularSorteo('—')).toBe('···');
  });
});
