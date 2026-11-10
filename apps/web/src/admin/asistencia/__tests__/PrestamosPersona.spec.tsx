import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const crear = vi.fn();
const anular = vi.fn();
const crearRec = vi.fn();
const editarRec = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarPrestamos: (...a: any[]) => listar(...a),
  crearPrestamo: (...a: any[]) => crear(...a),
  anularPrestamo: (...a: any[]) => anular(...a),
  crearRecurrente: (...a: any[]) => crearRec(...a),
  editarRecurrente: (...a: any[]) => editarRec(...a),
}));

import { PrestamosPersona, ServiciosExtraPersona } from '../PrestamosPersona';

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
    editarRec.mockResolvedValue({ ok: true });
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
    render(<ServiciosExtraPersona partyId={7} alCambiar={() => undefined} />);
    fireEvent.click(await screen.findByRole('button', { name: /Cobrar Netflix \(S\/ 1\.64 por semana\)/ }));
    await waitFor(() => expect(crearRec).toHaveBeenCalledWith({ partyId: 7, tipo: 'NETFLIX' }));
  });

  it('préstamo sin intereses: lo dice y no manda interés al crear', async () => {
    render(<PrestamosPersona partyId={7} alCambiar={() => undefined} />);
    expect(await screen.findByText('Sin intereses')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Monto \(S\/\)/), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar préstamo' }));
    await waitFor(() => expect(crear).toHaveBeenCalled());
    expect(crear.mock.calls[0][0]).not.toHaveProperty('interesPctMensual');
  });

  it('préstamo con interés: muestra capital, interés, cuota y saldo, y envía el % mensual', async () => {
    listar.mockResolvedValue({
      netflixSemanalDefecto: 1.64, recurrentes: [],
      prestamos: [{ ...prestamo, interesPctMensual: 2, capital: 300, interesTotal: 18, cuota: 106, montoCuota: 106, saldo: 212 }],
    });
    render(<PrestamosPersona partyId={7} alCambiar={() => undefined} />);
    expect(await screen.findByText('Interés 2 % mensual')).toBeInTheDocument();
    for (const [t, v] of [['Capital', 'S/ 300.00'], ['Interés', 'S/ 18.00'], ['Cuota', 'S/ 106.00'], ['Saldo', 'S/ 212.00']]) {
      expect(screen.getByText(t, { selector: 'dt' }).nextElementSibling).toHaveTextContent(v);
    }
    fireEvent.change(screen.getByLabelText(/Monto \(S\/\)/), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/Interés mensual/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar préstamo' }));
    await waitFor(() => expect(crear).toHaveBeenCalledWith(expect.objectContaining({ monto: 200, interesPctMensual: 3 })));
  });

  it('servicio extra: check por persona, monto y periodicidad', async () => {
    listar.mockResolvedValue({
      netflixSemanalDefecto: 1.64, prestamos: [],
      recurrentes: [{ id: 5, tipo: 'OTRO', nombre: 'Plan de celular', monto: 25, activo: true, desde: '2026-11-01', periodicidad: 'MENSUAL' }],
    });
    render(<ServiciosExtraPersona partyId={7} alCambiar={() => undefined} />);
    expect(await screen.findByText(/S\/ 25\.00 por mes/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cobrar Plan de celular')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Cobrar Plan de celular'));
    await waitFor(() => expect(editarRec).toHaveBeenCalledWith(5, { activo: false }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Gimnasio' } });
    fireEvent.change(screen.getByLabelText(/Monto \(S\/\)/), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Se cobra cada'), { target: { value: 'SEMANAL' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar servicio' }));
    await waitFor(() => expect(crearRec).toHaveBeenCalledWith({ partyId: 7, tipo: 'OTRO', nombre: 'Gimnasio', monto: 12, periodicidad: 'SEMANAL' }));
  });
});
