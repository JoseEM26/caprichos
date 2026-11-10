import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const detalle = vi.fn();
const pagar = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPlanilla: (...a: any[]) => listar(...a),
  detallePlanilla: (...a: any[]) => detalle(...a),
  pagarPlanilla: (...a: any[]) => pagar(...a),
}));

import { PlanillaTab } from '../PlanillaTab';
import { sueldoEquivalente } from '../planillaApi';

describe('sueldoEquivalente (web)', () => {
  it('mensual ×12/52 y semanal ×52/12', () => {
    expect(sueldoEquivalente('MENSUAL', 1000)).toEqual({ semanal: 230.77, mensual: 1000 });
    expect(sueldoEquivalente('SEMANAL', 300)).toEqual({ semanal: 300, mensual: 1300 });
  });
});

describe('PlanillaTab', () => {
  const resultado = {
    programadaMin: 3000, trabajadaMin: 1800, tardanzaMin: 0, salidaAnticipadaMin: 0, extraMin: 0, extraAprobadaMin: 0, valorHora: 20,
    pagoTrabajado: 600, pagoTardanza: 0, pagoExtra: 0, ganado: 600, consumosCobrados: 40, consumosPendientes: 0, descuentos: 0, adelantos: 0, neto: 560,
  };
  it('lista a la persona con sueldo semanal y mensual y abre el detalle; los consumos pasan al siguiente período al desmarcarlos', async () => {
    listar.mockResolvedValue({
      fecha: '2026-11-09',
      filas: [{ partyId: 7, nombre: 'Luis Pérez', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, estado: 'ABIERTO', programadasH: 50, trabajadasH: 30, ganado: 600, consumos: 40, descuentos: 0, adelantos: 0, neto: 560, pendientes: 0 }],
    });
    detalle.mockResolvedValue({
      partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 },
      estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pctTardanza: 50, pendientes: 0, resultado, dias: [],
      consumos: [{ id: '1', fecha: '2026-11-10', pedido: 'P-100', monto: 40, cobrar: true }], ajustes: [],
    });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    expect(await screen.findByText('Luis Pérez')).toBeInTheDocument();
    expect(screen.getByText('S/ 230.77')).toBeInTheDocument();
    expect(screen.getByText('S/ 1000.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByText(/Neto a pagar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Consumos/ }));
    fireEvent.click(await screen.findByLabelText('Cobrar en este pago el consumo P-100'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), ['1']));
  });
});
