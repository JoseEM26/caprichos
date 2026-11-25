import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listarTarifasEspeciales = vi.fn();
const crearTarifaEspecial = vi.fn();
const editarTarifaEspecial = vi.fn();
vi.mock('../planillaApi', async (orig) => ({
  ...(await orig<any>()),
  listarTarifasEspeciales: (...a: any[]) => listarTarifasEspeciales(...a),
  crearTarifaEspecial: (...a: any[]) => crearTarifaEspecial(...a),
  editarTarifaEspecial: (...a: any[]) => editarTarifaEspecial(...a),
}));

import { jornadaActual } from '../jornada';
import { InsigniaTarifaEspecial, SeccionTarifasEspeciales, TEXTO_AYUDA_TARIFA } from '../PlanillaPersonaTarifas';

const regla = (over: Record<string, unknown> = {}) => ({
  id: 3, diaSemana: 0, desdeHora: '19:00', tarifaHora: 15, vigenteDesde: '2026-11-15', vigenteHasta: null, activa: true, nota: null, ...over,
});
const montar = () => {
  const onCambio = vi.fn();
  const onError = vi.fn();
  const onOk = vi.fn();
  render(<SeccionTarifasEspeciales partyId={7} onCambio={onCambio} onError={onError} onOk={onOk} />);
  return { onCambio, onError, onOk };
};

describe('Tarifas especiales (planilla de la persona)', () => {
  beforeEach(() => {
    listarTarifasEspeciales.mockReset();
    crearTarifaEspecial.mockReset();
    editarTarifaEspecial.mockReset();
  });

  it('abre la sección y muestra la ayuda y las reglas con su estado', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [regla(), regla({ id: 4, diaSemana: 6, desdeHora: '18:00', tarifaHora: 12, activa: false })] });
    montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    expect(await screen.findByText(TEXTO_AYUDA_TARIFA)).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Inactiva')).toBeInTheDocument();
    expect(screen.getByText(/Domingo desde 19:00/)).toBeInTheDocument();
    expect(screen.getByText('S/ 15.00/h')).toBeInTheDocument();
    expect(listarTarifasEspeciales).toHaveBeenCalledWith(7);
  });

  it('el formulario de agregar trae los valores por defecto: Domingo, 19:00, S/ 15.00 y vigente desde hoy', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [] });
    montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarifa especial' }));
    const form = screen.getByRole('dialog', { name: 'Agregar tarifa especial' });
    expect(within(form).getByLabelText('Día')).toHaveValue('0');
    expect(within(form).getByLabelText('Desde la hora')).toHaveValue('19:00');
    expect(within(form).getByLabelText('Tarifa por hora (S/)')).toHaveValue(15);
    expect(within(form).getByLabelText('Vigente desde')).toHaveValue(jornadaActual());
  });

  it('guarda una regla nueva con los datos del formulario y avisa', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [] });
    crearTarifaEspecial.mockResolvedValue({ ok: true, id: 9 });
    const { onCambio, onOk } = montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarifa especial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar tarifa especial' }));
    await waitFor(() => expect(onOk).toHaveBeenCalledWith('Tarifa especial agregada.'));
    expect(crearTarifaEspecial).toHaveBeenCalledWith(expect.objectContaining({ partyId: 7, diaSemana: 0, desdeHora: '19:00', tarifaHora: 15, vigenteHasta: '' }));
    expect(onCambio).toHaveBeenCalled();
  });

  it('el formulario es una ventana: Esc la cierra sin llamar a la API', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [] });
    montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarifa especial' }));
    expect(screen.getByRole('dialog', { name: 'Agregar tarifa especial' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(crearTarifaEspecial).not.toHaveBeenCalled();
  });

  it('no deja guardar una tarifa de cero', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [] });
    montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar tarifa especial' }));
    const form = screen.getByRole('dialog', { name: 'Agregar tarifa especial' });
    fireEvent.change(within(form).getByLabelText('Tarifa por hora (S/)'), { target: { value: '0' } });
    expect(within(form).getByRole('button', { name: 'Agregar tarifa especial' })).toBeDisabled();
    expect(within(form).getByText('La tarifa por hora debe ser mayor que cero.')).toBeInTheDocument();
  });

  it('desactivar una regla la manda como activa=false', async () => {
    listarTarifasEspeciales.mockResolvedValue({ reglas: [regla()] });
    editarTarifaEspecial.mockResolvedValue({ ok: true });
    const { onOk } = montar();
    fireEvent.click(screen.getByText('Tarifas especiales'));
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(onOk).toHaveBeenCalledWith('Tarifa especial desactivada.'));
    expect(editarTarifaEspecial).toHaveBeenCalledWith(3, { activa: false });
  });

  it('insignia con la tarifa y la hora', () => {
    render(<InsigniaTarifaEspecial t={{ desdeHora: '19:00', tarifaHora: 15 }} />);
    expect(screen.getByText('Tarifa especial S/ 15.00/h desde 19:00')).toBeInTheDocument();
  });
});
