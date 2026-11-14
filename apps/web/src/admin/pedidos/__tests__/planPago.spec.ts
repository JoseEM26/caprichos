import { describe, it, expect } from 'vitest';
import { ajustarPlan, errorPlan, MAX_MEDIOS_PLAN, type FilaPlan } from '../planPago';

const f = (medio: FilaPlan['medio'], monto: string): FilaPlan => ({ medio, monto });

describe('planPago: 1, 2 o 3 medios', () => {
  it('el máximo es 3 y 4 renglones se rechazan aunque sumen', () => {
    expect(MAX_MEDIOS_PLAN).toBe(3);
    expect(errorPlan(20, [f('YAPE', '5'), f('PLIN', '5'), f('EFECTIVO', '5'), f('TARJETA', '5')])).toMatch(/hasta 3/);
  });
  it('3 medios que suman el total son válidos; falta y sobra se dicen', () => {
    expect(errorPlan(20, [f('YAPE', '10'), f('PLIN', '5.50'), f('EFECTIVO', '4.50')])).toBeNull();
    expect(errorPlan(20, [f('YAPE', '10'), f('PLIN', '5'), f('EFECTIVO', '4')])).toMatch(/Falta S\/ 1\.00/);
    expect(errorPlan(20, [f('YAPE', '10'), f('PLIN', '6'), f('EFECTIVO', '5')])).toMatch(/Sobra S\/ 1\.00/);
  });
  it('repetidos, montos vacíos y más de 2 decimales se rechazan', () => {
    expect(errorPlan(20, [f('YAPE', '10'), f('YAPE', '10')])).toMatch(/una vez/);
    expect(errorPlan(20, [f('YAPE', '20'), f('PLIN', '')])).toMatch(/monto/);
    expect(errorPlan(20, [f('YAPE', '10.005'), f('PLIN', '9.995')])).toMatch(/2 decimales/);
  });
  it('ajustarPlan: la primera fila se queda con lo que falta del total (3 medios)', () => {
    expect(ajustarPlan(20, [f('EFECTIVO', ''), f('YAPE', '8'), f('PLIN', '7')]).map((x) => x.monto)).toEqual(['5.00', '8', '7']);
  });
});
