import { interesDeCuota, interesPrestamo, PrestamoCalc, cuotaDelPeriodo, descuentoPersonalDelPeriodo, montoRecurrenteDelPeriodo, planCuotas, saldoPrestamo } from './prestamos.calculo';

const prestamo = (over: Partial<PrestamoCalc> = {}): PrestamoCalc => ({
  id: '1',
  periodicidad: 'SEMANAL',
  fechaInicio: '2026-11-01',
  estado: 'ACTIVO',
  cuotas: [1, 2, 3].map((n) => ({ id: String(n), prestamoId: '1', numero: n, monto: 100, estado: 'PENDIENTE' as const })),
  ...over,
});
const semana = { desde: '2026-11-09', hasta: '2026-11-15' };

describe('préstamos al personal', () => {
  it('plan de cuotas iguales; la última absorbe los céntimos', () => {
    expect(planCuotas(300, 3)).toEqual([100, 100, 100]);
    expect(planCuotas(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(planCuotas(50, 1)).toEqual([50]);
  });

  it('entra la primera cuota pendiente; omitida pasa al final (la siguiente es la 2)', () => {
    const p = prestamo();
    expect(cuotaDelPeriodo(p, 'SEMANAL', semana)?.numero).toBe(1);
    p.cuotas[0].estado = 'OMITIDA';
    p.cuotas.push({ id: '4', prestamoId: '1', numero: 4, monto: 100, estado: 'PENDIENTE' });
    expect(cuotaDelPeriodo(p, 'SEMANAL', semana)?.numero).toBe(2);
  });

  it('no entra si está anulado, saldado, sin iniciar o sin cuotas pendientes', () => {
    expect(cuotaDelPeriodo(prestamo({ estado: 'ANULADO' }), 'SEMANAL', semana)).toBeNull();
    expect(cuotaDelPeriodo(prestamo({ estado: 'SALDADO' }), 'SEMANAL', semana)).toBeNull();
    expect(cuotaDelPeriodo(prestamo({ fechaInicio: '2026-11-20' }), 'SEMANAL', semana)).toBeNull();
    expect(cuotaDelPeriodo(prestamo({ cuotas: [] }), 'SEMANAL', semana)).toBeNull();
  });

  it('préstamo mensual en planilla semanal: una sola cuota por mes', () => {
    const p = prestamo({ periodicidad: 'MENSUAL' });
    p.cuotas[0] = { ...p.cuotas[0], estado: 'DESCONTADA', periodoHasta: '2026-11-08' };
    expect(cuotaDelPeriodo(p, 'SEMANAL', semana)).toBeNull();
    expect(cuotaDelPeriodo(p, 'SEMANAL', { desde: '2026-11-30', hasta: '2026-12-06' })?.numero).toBe(2);
  });

  it('saldo = prestado − descontado; llega a 0 al terminar', () => {
    const cuotas = [{ monto: 100, estado: 'DESCONTADA' }, { monto: 100, estado: 'PENDIENTE' }, { monto: 100, estado: 'OMITIDA' }];
    expect(saldoPrestamo(300, cuotas)).toBe(200);
    expect(saldoPrestamo(300, cuotas.map((c) => ({ ...c, estado: 'DESCONTADA' })))).toBe(0);
  });

  it('descuento recurrente semanal: ×1 en semana, ×4 en mes', () => {
    expect(montoRecurrenteDelPeriodo(1.64, 'SEMANAL')).toBe(1.64);
    expect(montoRecurrenteDelPeriodo(1.64, 'MENSUAL')).toBe(6.56);
  });
});

describe('interés simple mensual de los préstamos', () => {
  it('0 % = sin interés; mensual: capital × % × n; semanal: n × 12/52 meses', () => {
    expect(interesPrestamo(100, 0, 4, 'MENSUAL')).toBe(0);
    expect(interesPrestamo(100, 5, 4, 'MENSUAL')).toBe(20);
    expect(interesPrestamo(1300, 10, 13, 'SEMANAL')).toBe(390); // 13 semanas = 3 meses
  });
  it('parte de interés de una cuota y saldo sobre el total', () => {
    expect(interesDeCuota(30, 100, 20)).toBe(5);
    expect(interesDeCuota(25, 100, 0)).toBe(0);
    expect(saldoPrestamo(120, [{ monto: 30, estado: 'DESCONTADA' }, { monto: 30, estado: 'PENDIENTE' }])).toBe(90);
  });
  it('servicio extra mensual: ×1 en planilla mensual, ÷4 en semanal; semanal: ×1 y ×4', () => {
    expect(montoRecurrenteDelPeriodo(40, 'MENSUAL', 'MENSUAL')).toBe(40);
    expect(montoRecurrenteDelPeriodo(40, 'SEMANAL', 'MENSUAL')).toBe(10);
    expect(montoRecurrenteDelPeriodo(2, 'MENSUAL')).toBe(8);
    expect(montoRecurrenteDelPeriodo(2, 'SEMANAL', 'SEMANAL')).toBe(2);
  });
});

describe('descuentos y bonos personalizados del personal', () => {
  const sueldo = { semanal: 200, mensual: 800 };
  const sem = { desde: '2026-11-09', hasta: '2026-11-15' };
  const mes = { desde: '2026-11-01', hasta: '2026-11-30' };
  const base = { valorTipo: 'MONTO' as const, hasta: null };
  it('única vez: solo en el período que contiene la fecha de inicio', () => {
    const d = { ...base, valor: 30, periodicidad: 'UNICA' as const, desde: '2026-11-12' };
    expect(descuentoPersonalDelPeriodo(d, 'SEMANAL', sem, sueldo)).toBe(30);
    expect(descuentoPersonalDelPeriodo(d, 'SEMANAL', { desde: '2026-11-16', hasta: '2026-11-22' }, sueldo)).toBeNull();
    expect(descuentoPersonalDelPeriodo(d, 'SEMANAL', { desde: '2026-11-02', hasta: '2026-11-08' }, sueldo)).toBeNull();
    expect(descuentoPersonalDelPeriodo(d, 'MENSUAL', mes, sueldo)).toBe(30);
  });
  it('semanal: cada semana (×4 en planilla mensual); mensual: una vez al mes (÷4 en semanal)', () => {
    const s = { ...base, valor: 5, periodicidad: 'SEMANAL' as const, desde: '2026-10-01' };
    expect(descuentoPersonalDelPeriodo(s, 'SEMANAL', sem, sueldo)).toBe(5);
    expect(descuentoPersonalDelPeriodo(s, 'MENSUAL', mes, sueldo)).toBe(20);
    const m = { ...base, valor: 40, periodicidad: 'MENSUAL' as const, desde: '2026-10-01' };
    expect(descuentoPersonalDelPeriodo(m, 'MENSUAL', mes, sueldo)).toBe(40);
    expect(descuentoPersonalDelPeriodo(m, 'SEMANAL', sem, sueldo)).toBe(10);
  });
  it('vigencia: antes del inicio o después del fin no se aplica', () => {
    const s = { ...base, valor: 5, periodicidad: 'SEMANAL' as const, desde: '2026-11-10', hasta: '2026-11-20' };
    expect(descuentoPersonalDelPeriodo(s, 'SEMANAL', { desde: '2026-11-02', hasta: '2026-11-08' }, sueldo)).toBeNull();
    expect(descuentoPersonalDelPeriodo(s, 'SEMANAL', sem, sueldo)).toBe(5);
    expect(descuentoPersonalDelPeriodo(s, 'SEMANAL', { desde: '2026-11-16', hasta: '2026-11-22' }, sueldo)).toBe(5);
    expect(descuentoPersonalDelPeriodo(s, 'SEMANAL', { desde: '2026-11-23', hasta: '2026-11-29' }, sueldo)).toBeNull();
  });
  it('porcentaje: % del sueldo semanal, mensual o del período (única vez)', () => {
    expect(descuentoPersonalDelPeriodo({ ...base, valorTipo: 'PORCENTAJE', valor: 10, periodicidad: 'SEMANAL', desde: '2026-10-01' }, 'SEMANAL', sem, sueldo)).toBe(20);
    expect(descuentoPersonalDelPeriodo({ ...base, valorTipo: 'PORCENTAJE', valor: 5, periodicidad: 'MENSUAL', desde: '2026-10-01' }, 'MENSUAL', mes, sueldo)).toBe(40);
    expect(descuentoPersonalDelPeriodo({ ...base, valorTipo: 'PORCENTAJE', valor: 5, periodicidad: 'UNICA', desde: '2026-11-03' }, 'MENSUAL', mes, sueldo)).toBe(40);
  });
});
