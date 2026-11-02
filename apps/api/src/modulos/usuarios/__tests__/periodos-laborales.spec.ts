import {
  duracion,
  errorPeriodo,
  fechaDia,
  formatoDuracion,
  seSolapan,
  tiempoTotal,
  vecesQueSalio,
  diaAnterior,
} from '../periodos-laborales';

const d = (t: string) => fechaDia(t) as Date;

describe('periodos laborales', () => {
  it('duración calendario: 02/07/2024 a 15/03/2025 son 8 meses 13 días', () => {
    const x = duracion(d('2024-07-02'), d('2025-03-15'));
    expect(x).toEqual({ anios: 0, meses: 8, dias: 13 });
    expect(formatoDuracion(x)).toBe('8 meses 13 días');
  });

  it('20/06/2025 a 20/10/2026 son 1 año 4 meses (sin días) al mostrar', () => {
    const x = duracion(d('2025-06-20'), d('2026-10-20'));
    expect(formatoDuracion(x)).toBe('1 año 4 meses');
  });

  it('días negativos piden el mes anterior (31 de enero a 1 de marzo)', () => {
    expect(duracion(d('2025-01-31'), d('2025-03-01'))).toEqual({ anios: 0, meses: 1, dias: 1 });
  });

  it('solapes: días inclusivos; el día anterior al reingreso no se cruza', () => {
    const a = { desde: d('2024-07-02'), hasta: d('2025-03-14') };
    const b = { desde: d('2025-03-15'), hasta: null };
    expect(seSolapan(a, b)).toBe(false);
    expect(seSolapan(a, { desde: d('2025-03-14'), hasta: null })).toBe(true);
    expect(seSolapan(a, { desde: d('2024-01-01'), hasta: null })).toBe(true);
  });

  it('errorPeriodo: desde ≤ hasta y sin cruces con los demás', () => {
    const otros = [{ desde: d('2024-07-02'), hasta: d('2025-03-14') }];
    expect(errorPeriodo({ desde: d('2025-05-01'), hasta: d('2025-04-01') }, [])).toMatch(/anterior/);
    expect(errorPeriodo({ desde: d('2025-03-01'), hasta: d('2025-04-01') }, otros)).toMatch(/cruzan/);
    expect(errorPeriodo({ desde: d('2025-03-15'), hasta: null }, otros)).toBeNull();
  });

  it('tiempo total suma periodos (abiertos hasta hoy) y cuenta las salidas', () => {
    const periodos = [
      { desde: d('2024-01-01'), hasta: d('2024-12-31') }, // 365 días
      { desde: d('2025-01-01'), hasta: null },
    ];
    const hoy = d('2026-01-01'); // 365 días abierto
    const t = tiempoTotal(periodos, hoy);
    expect(t.totalDias).toBe(730);
    expect(t.anios).toBe(2);
    expect(vecesQueSalio(periodos)).toBe(1);
    expect(diaAnterior(d('2025-03-15')).toISOString().slice(0, 10)).toBe('2025-03-14');
  });
});
