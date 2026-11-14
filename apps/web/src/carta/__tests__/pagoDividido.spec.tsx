import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdjuntarCapturaPago } from '../AdjuntarCapturaPago';
import { armarPlanCarta, estadoDiv, filasVisibles, montoDigitalCarta } from '../pagoDividido';
import type { MetodoPago } from '../tipos';

describe('carta: pago dividido', () => {
  const original = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = original;
  });

  it('la tarjeta «Paga con Yape» muestra solo S/ 38 y avisa que S/ 2 se pagan al recibir', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ whatsapp: '987654321', mediosPago: { yape: { activo: true, numero: '977503006', titular: 'Maria' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    render(<AdjuntarCapturaPago codigo="CP-1" token="t" pagoDigital medio="YAPE" total={38} restoAlRecibir={2} />);
    expect(await screen.findByText('977503006')).toBeDefined();
    expect(screen.getByText('S/ 38.00')).toBeDefined();
    expect(screen.getByText(/S\/ 2\.00 restantes/)).toBeDefined();
  });

  const f = (medio: MetodoPago, monto: string) => ({ medio, monto });
  const TODOS: MetodoPago[] = ['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA'];

  it('armarPlanCarta: 2 medios, el último se autocompleta con lo que falta', () => {
    expect(armarPlanCarta([f('YAPE', '38'), f('EFECTIVO', '')], 40, TODOS).plan).toEqual([
      { medio: 'YAPE', monto: 38 },
      { medio: 'EFECTIVO', monto: 2 },
    ]);
    expect(montoDigitalCarta([{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }])).toBe(38);
  });

  it('armarPlanCarta: 3 medios suman el total al céntimo', () => {
    const r = armarPlanCarta([f('YAPE', '10.10'), f('PLIN', '9.90'), f('EFECTIVO', '')], 30.5, TODOS);
    expect(r.plan).toEqual([{ medio: 'YAPE', monto: 10.1 }, { medio: 'PLIN', monto: 9.9 }, { medio: 'EFECTIVO', monto: 10.5 }]);
    expect(r.plan!.reduce((a, x) => a + Math.round(x.monto * 100), 0)).toBe(3050);
  });

  it('armarPlanCarta: rechaza repetidos, 1 solo, 4 renglones, medio no permitido, montos malos y suma que no cuadra', () => {
    expect(armarPlanCarta([f('YAPE', '10'), f('YAPE', '')], 40, TODOS).error).toMatch(/distintos/);
    expect(armarPlanCarta([f('YAPE', '')], 40, TODOS).error).toMatch(/al menos 2/);
    expect(armarPlanCarta([f('YAPE', '5'), f('PLIN', '5'), f('EFECTIVO', '5'), f('TARJETA', '')], 40, TODOS).error).toMatch(/Máximo 3/);
    expect(armarPlanCarta([f('YAPE', '10'), f('EFECTIVO', '')], 40, ['EFECTIVO', 'PLIN']).error).toMatch(/YAPE no está disponible/);
    expect(armarPlanCarta([f('YAPE', ''), f('EFECTIVO', '')], 40, TODOS).error).toMatch(/Escribe cuánto pagas con YAPE/);
    expect(armarPlanCarta([f('YAPE', '0'), f('EFECTIVO', '')], 40, TODOS).error).toBeTruthy();
    expect(armarPlanCarta([f('YAPE', '10.005'), f('EFECTIVO', '')], 40, TODOS).error).toBeTruthy();
    // los renglones escritos ya pasan del total: sobra
    expect(armarPlanCarta([f('YAPE', '30'), f('PLIN', '15'), f('EFECTIVO', '')], 40, TODOS).error).toMatch(/Sobra S\/ 5\.00/);
    expect(armarPlanCarta([f('YAPE', '40'), f('EFECTIVO', '')], 40, TODOS).error).toMatch(/queda en S\/ 0\.00/);
  });

  it('estadoDiv y filasVisibles: Falta / Sobra en vivo y último renglón autocompletado', () => {
    expect(estadoDiv([f('YAPE', ''), f('EFECTIVO', '')], 40)).toEqual({ tipo: 'falta', monto: 40 });
    expect(estadoDiv([f('YAPE', '25'), f('EFECTIVO', '')], 40)).toEqual({ tipo: 'cuadra', monto: 0 });
    expect(estadoDiv([f('YAPE', '45'), f('EFECTIVO', '')], 40)).toEqual({ tipo: 'sobra', monto: 5 });
    expect(filasVisibles([f('YAPE', '25'), f('PLIN', '5'), f('EFECTIVO', '')], 40)[2].monto).toBe('10.00');
  });
});
