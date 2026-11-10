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
    expect(screen.getByText('S/ 1000.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByText(/Neto a pagar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Consumos/ }));
    fireEvent.click(await screen.findByLabelText('Cobrar en este pago el consumo P-100'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), ['1'], [], []));
  });

  it('estilo Excel: columnas calculadas por el servidor, descuentos por etiqueta, datos de pago con copiar y LIQUIDADO', async () => {
    const copiar = vi.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText: copiar } });
    const excel = {
      pagoPorDia: 62.5, valorHora: 6.94, horasLaboradas: 10, minutosLaborados: 25, horasExtra: 1, total: 72.34, adicional: 20,
      descuentos: 16.64, descuentosPorCategoria: { NETFLIX: 1.64, MERMA: 15 }, netoAPagar: 75.7, adelanto: 30, diferencia: 45.7,
    };
    const pago = { celular: '999000111', medio: 'YAPE' };
    listar.mockResolvedValue({
      fecha: '2026-11-09',
      filas: [{ partyId: 7, nombre: 'Luis Pérez', sueldo: { modalidad: 'MENSUAL', semanal: 346.15, mensual: 1500, metodo: 'DIAS_HORAS' }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, estado: 'PAGADO', pendientes: 0, excel, pago }],
    });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    expect(await screen.findByText('10 h 25 min')).toBeInTheDocument();
    expect(screen.getByText('S/ 62.50')).toBeInTheDocument();
    expect(screen.getByText('S/ 45.70')).toBeInTheDocument();
    expect(screen.getByText('Merma: S/ 15.00')).toBeInTheDocument();
    expect(screen.getByText('Netflix: S/ 1.64')).toBeInTheDocument();
    expect(screen.getByText('LIQUIDADO')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar el número de pago' }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith('999000111'));
  });

  it('una cuota de préstamo se puede omitir en este pago y se vuelve a pedir el cálculo', async () => {
    listar.mockResolvedValue({
      fecha: '2026-11-09',
      filas: [{ partyId: 7, nombre: 'Luis Pérez', sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 }, periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, estado: 'ABIERTO', pendientes: 0 }],
    });
    detalle.mockResolvedValue({
      partyId: 7, nombre: 'Luis Pérez', periodo: { desde: '2026-11-01', hasta: '2026-11-30' }, sueldo: { modalidad: 'MENSUAL', semanal: 230.77, mensual: 1000 },
      estado: 'ABIERTO', periodoId: null, toleranciaMin: 5, pctTardanza: 0, pendientes: 0, resultado, dias: [], consumos: [], ajustes: [],
      cuotas: [{ id: '90', prestamoId: '1', numero: 1, numCuotas: 3, monto: 100, motivo: null, cobrar: true }],
      recurrentes: [{ id: '5', tipo: 'NETFLIX', nombre: 'Netflix', monto: 6.56, cobrar: true }],
    });
    render(<PlanillaTab onError={() => undefined} onOk={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir' }));
    fireEvent.click(await screen.findByLabelText('Cobrar la cuota 1 del préstamo'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], []));
    fireEvent.click(screen.getByLabelText('Cobrar Netflix en este pago'));
    await waitFor(() => expect(detalle).toHaveBeenLastCalledWith(7, expect.any(String), [], ['90'], ['5']));
  });
});
