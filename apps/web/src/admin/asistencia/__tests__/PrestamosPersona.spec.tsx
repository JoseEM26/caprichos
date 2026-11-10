import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const crear = vi.fn();
const anular = vi.fn();
const crearRec = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPrestamos: (...a: any[]) => listar(...a),
  crearPrestamo: (...a: any[]) => crear(...a),
  anularPrestamo: (...a: any[]) => anular(...a),
  crearRecurrente: (...a: any[]) => crearRec(...a),
}));

import { PrestamosPersona } from '../PrestamosPersona';

const prestamo = {
  id: 3, monto: 300, numCuotas: 3, periodicidad: 'SEMANAL', montoCuota: 100, fechaInicio: '2026-11-01', estado: 'ACTIVO', motivo: 'Emergencia', anuladoMotivo: null, saldo: 200,
  cuotas: [
    { id: 1, numero: 1, monto: 100, estado: 'DESCONTADA', periodoDesde: '2026-11-02', periodoHasta: '2026-11-08', reprogramada: false },
    { id: 2, numero: 2, monto: 100, estado: 'PENDIENTE', periodoDesde: null, periodoHasta: null, reprogramada: false },
    { id: 3, numero: 3, monto: 100, estado: 'PENDIENTE', periodoDesde: null, periodoHasta: null, reprogramada: false },
  ],
};

describe('PrestamosPersona', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listar.mockResolvedValue({ netflixSemanalDefecto: 1.64, prestamos: [prestamo], recurrentes: [] });
    crear.mockResolvedValue({ ok: true });
    anular.mockResolvedValue({ ok: true });
    crearRec.mockResolvedValue({ ok: true });
  });

  it('muestra el plan, el saldo y el estado de cada cuota', async () => {
    render(<PrestamosPersona partyId={7} alCambiar={() => undefined} />);
    expect(await screen.findByText('Saldo S/ 200.00')).toBeInTheDocument();
    expect(screen.getByText('Descontada')).toBeInTheDocument();
    expect(screen.getAllByText('Pendiente')).toHaveLength(2);
    expect(screen.getByText('Emergencia')).toBeInTheDocument();
  });

  it('crea un préstamo con monto, cuotas y periodicidad', async () => {
    const alCambiar = vi.fn();
    render(<PrestamosPersona partyId={7} alCambiar={alCambiar} />);
    await screen.findByText('Saldo S/ 200.00');
    fireEvent.change(screen.getByLabelText(/Monto \(S\/\)/), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Cuotas'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar préstamo' }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ partyId: 7, monto: 120, numCuotas: 4, periodicidad: 'SEMANAL' })));
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
  });

  it('anular exige un motivo', async () => {
    render(<PrestamosPersona partyId={7} alCambiar={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Anular préstamo' }));
    expect(screen.getAllByRole('button', { name: 'Anular préstamo' }).at(-1)!).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), { target: { value: 'Se perdonó' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Anular préstamo' }).at(-1)!);
    await waitFor(() => expect(anular).toHaveBeenCalledWith(3, 'Se perdonó'));
  });

  it('agrega Netflix con el monto general', async () => {
    render(<PrestamosPersona partyId={7} alCambiar={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /Cobrar Netflix \(S\/ 1\.64 por semana\)/ }));
    await waitFor(() => expect(crearRec).toHaveBeenCalledWith({ partyId: 7, tipo: 'NETFLIX' }));
  });
});
