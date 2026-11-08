import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdjuntarCapturaPago } from '../AdjuntarCapturaPago';
import { armarPlanCarta, montoDigitalCarta } from '../pagoDividido';

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

  it('armarPlanCarta: Yape 38 de 40 deja 2 al segundo medio; rechaza iguales, vacíos y >= total', () => {
    expect(armarPlanCarta('YAPE', '38', 'EFECTIVO', 40).plan).toEqual([
      { medio: 'YAPE', monto: 38 },
      { medio: 'EFECTIVO', monto: 2 },
    ]);
    expect(armarPlanCarta('YAPE', '38', 'YAPE', 40).error).toMatch(/distintos/);
    expect(armarPlanCarta('YAPE', '', 'EFECTIVO', 40).error).toBeTruthy();
    expect(armarPlanCarta('YAPE', '40', 'EFECTIVO', 40).error).toMatch(/menor a S\/ 40\.00/);
    expect(armarPlanCarta('YAPE', '10.005', 'EFECTIVO', 40).error).toBeTruthy();
    expect(montoDigitalCarta([{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }])).toBe(38);
  });
});
