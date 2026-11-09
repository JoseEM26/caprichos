import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const obtener = vi.fn();
const guardar = vi.fn();
const registrar = vi.fn();
const anular = vi.fn();
const subir = vi.fn();
const mi = vi.fn();
vi.mock('../vinculoApi', async (orig) => ({
  ...(await orig<any>()),
  obtenerVinculo: (...a: any[]) => obtener(...a),
  guardarVinculo: (...a: any[]) => guardar(...a),
  registrarVacaciones: (...a: any[]) => registrar(...a),
  anularVacaciones: (...a: any[]) => anular(...a),
  subirContrato: (...a: any[]) => subir(...a),
  miVacaciones: (...a: any[]) => mi(...a),
}));

import { PestanaVinculoVacaciones } from '../VinculoVacaciones';
import { MiVacaciones } from '../MiVacaciones';

const planilla = {
  vigente: { id: 1, tipo: 'PLANILLA', fechaIngreso: '2026-07-15', fechaFin: null, regimenVacaciones: 30, tieneContrato: false, notas: null, vigenteDesde: '2026-07-15T00:00:00Z', vigenteHasta: null },
  historial: [],
  vacaciones: { regimen: 30, ingreso: '2026-07-15', ganados: 15, tomadas: 2, pagadas: 0, ajustes: 0, saldo: 13, movimientos: [{ id: 9, tipo: 'TOMADAS', desde: '2027-01-04', hasta: '2027-01-05', dias: 2, monto: null, motivo: null, anulado: false }] },
};

beforeEach(() => vi.clearAllMocks());

describe('Vínculo y vacaciones', () => {
  it('muestra saldo y movimientos, y registra vacaciones tomadas', async () => {
    obtener.mockResolvedValue(planilla);
    registrar.mockResolvedValue({ ok: true });
    render(<PestanaVinculoVacaciones partyId={7} />);
    expect(await screen.findByText('13 día(s)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar vacaciones tomadas' }));
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2027-02-01' } });
    fireEvent.change(screen.getByLabelText('Hasta (inclusive)'), { target: { value: '2027-02-03' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ partyId: 7, tipo: 'TOMADAS', desde: '2027-02-01', hasta: '2027-02-03' })));
    expect(await screen.findByText('Movimiento registrado.')).toBeInTheDocument();
  });

  it('al elegir contrato temporal avisa (sin bloquear) y oculta el régimen de vacaciones', async () => {
    obtener.mockResolvedValue(planilla);
    render(<PestanaVinculoVacaciones partyId={7} />);
    await screen.findByText('13 día(s)');
    fireEvent.change(screen.getByLabelText('Tipo de vínculo'), { target: { value: 'CONTRATO_TEMPORAL' } });
    expect(screen.getByRole('note')).toHaveTextContent('Un contrato sin subordinación no es compatible con horario fijo y asistencia obligatoria; valídalo con tu contador o abogado');
    expect(screen.queryByLabelText('Vacaciones al año')).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar vínculo' })).toBeEnabled();
  });

  it('rechaza en el navegador un contrato que no es PDF', async () => {
    obtener.mockResolvedValue(planilla);
    render(<PestanaVinculoVacaciones partyId={7} />);
    await screen.findByText('13 día(s)');
    const input = screen.getByLabelText(/Contrato firmado/) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'c.png', { type: 'image/png' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('PDF de máximo 5 MB');
    expect(subir).not.toHaveBeenCalled();
  });

  it('contrato temporal: las vacaciones no aplican', async () => {
    obtener.mockResolvedValue({ ...planilla, vigente: { ...planilla.vigente, tipo: 'CONTRATO_TEMPORAL' }, vacaciones: null });
    render(<PestanaVinculoVacaciones partyId={7} />);
    expect(await screen.findByText(/solo al personal en planilla/)).toBeInTheDocument();
  });

  it('Mi asistencia: saldo propio sin dinero; no aparece si no aplica', async () => {
    mi.mockResolvedValue({ aplica: true, regimen: 30, ingreso: '2026-07-15', ganados: 15, tomadas: 2, pagadas: 0, ajustes: 0, saldo: 13, movimientos: [] });
    const { unmount } = render(<MiVacaciones />);
    expect(await screen.findByText('13 día(s)')).toBeInTheDocument();
    expect(screen.queryByText(/S\//)).toBeNull();
    unmount();
    mi.mockResolvedValue({ aplica: false });
    const { container } = render(<MiVacaciones />);
    await waitFor(() => expect(mi).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
  });
});
