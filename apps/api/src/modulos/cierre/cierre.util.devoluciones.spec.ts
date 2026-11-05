import { rangoDiaCaja, sumarDevolucionesDigitales } from './cierre.util';

describe('cierre.util: devoluciones digitales por día de caja', () => {
  // Caja del 21/10/2026 en Lima: [2026-10-21T05:00Z, 2026-10-22T05:00Z)
  const { inicio, fin } = rangoDiaCaja(new Date('2026-10-21T00:00:00.000Z'));
  const fila = (medio: string, monto: unknown, creado: string) => ({
    medio,
    monto_devuelto: monto,
    creado_en: new Date(creado),
  });

  it('el rango del día de la caja va de 00:00 Lima a 00:00 Lima del día siguiente', () => {
    expect(inicio.toISOString()).toBe('2026-10-21T05:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-10-22T05:00:00.000Z');
  });

  it('sin devoluciones todos los medios digitales quedan en 0', () => {
    expect(sumarDevolucionesDigitales([], inicio, fin)).toEqual({ yape: 0, plin: 0, transferencia: 0, tarjeta: 0 });
  });

  it('suma por medio, con varias devoluciones del mismo medio y céntimos exactos', () => {
    const r = sumarDevolucionesDigitales(
      [
        fila('YAPE', 50, '2026-10-21T15:00:00Z'),
        fila('YAPE', 0.1, '2026-10-21T16:00:00Z'),
        fila('YAPE', 0.2, '2026-10-21T16:30:00Z'),
        fila('PLIN', 12.5, '2026-10-21T17:00:00Z'),
        fila('TRANSFERENCIA', 80, '2026-10-21T18:00:00Z'),
        fila('TARJETA', 30, '2026-10-21T19:00:00Z'),
      ],
      inicio,
      fin,
    );
    expect(r).toEqual({ yape: 50.3, plin: 12.5, transferencia: 80, tarjeta: 30 });
  });

  it('las devoluciones en efectivo no cuentan como digitales', () => {
    const r = sumarDevolucionesDigitales([fila('EFECTIVO', 40, '2026-10-21T15:00:00Z')], inicio, fin);
    expect(r).toEqual({ yape: 0, plin: 0, transferencia: 0, tarjeta: 0 });
  });

  it('el medio se compara sin importar espacios ni mayúsculas', () => {
    const r = sumarDevolucionesDigitales([fila(' yape ', 10, '2026-10-21T15:00:00Z')], inicio, fin);
    expect(r.yape).toBe(10);
  });

  it('las devoluciones de otro día no cuentan: ni las de la víspera ni las de después de la caja', () => {
    const r = sumarDevolucionesDigitales(
      [
        fila('YAPE', 50, '2026-10-21T04:59:59.999Z'), // 23:59 del día anterior en Lima
        fila('YAPE', 40, '2026-10-22T05:00:00.000Z'), // 00:00 del día siguiente en Lima
        fila('YAPE', 7, '2026-10-21T05:00:00.000Z'), // primer instante del día: sí cuenta
      ],
      inicio,
      fin,
    );
    expect(r.yape).toBe(7);
  });
});
