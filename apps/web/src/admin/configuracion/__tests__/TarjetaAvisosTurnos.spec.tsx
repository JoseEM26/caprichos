import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ avisosTurnos: vi.fn(), configurarAvisoTurno: vi.fn() }));
vi.mock('../../asistencia/turnosApi', async (orig) => ({
  ...(await orig<typeof import('../../asistencia/turnosApi')>()),
  avisosTurnos: (...a: any[]) => api.avisosTurnos(...a),
  configurarAvisoTurno: (...a: any[]) => api.configurarAvisoTurno(...a),
}));

import { TarjetaAvisosTurnos } from '../TarjetaAvisosTurnos';

const personas = [
  { partyId: 50, nombre: 'Sofía Quispe', rol: 'SUPERVISOR', avisos: true, canal: { celular: true, correo: true } },
  { partyId: 61, nombre: 'Julio Ramos', rol: 'ADMIN', avisos: false, canal: { celular: false, correo: true } },
  { partyId: 62, nombre: 'Elena Mora', rol: 'ADMIN', avisos: true, canal: { celular: false, correo: false } },
];

beforeEach(() => {
  api.avisosTurnos.mockReset().mockResolvedValue(personas);
  api.configurarAvisoTurno.mockReset().mockResolvedValue({ ok: true });
});

describe('Configuración: quién recibe avisos de reemplazos y cambios de turno', () => {
  it('lista al personal de Supervisión y Administración con el canal de cada uno', async () => {
    render(<TarjetaAvisosTurnos />);
    expect(await screen.findByLabelText(/Sofía Quispe/)).toBeChecked();
    expect(screen.getByLabelText(/Julio Ramos/)).not.toBeChecked();
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Correo (no tiene celular)')).toBeInTheDocument();
    expect(screen.getByText('Sin celular ni correo')).toBeInTheDocument();
  });

  it('marcar o desmarcar una persona la guarda en el servidor', async () => {
    render(<TarjetaAvisosTurnos />);
    fireEvent.click(await screen.findByLabelText(/Julio Ramos/));
    await waitFor(() => expect(api.configurarAvisoTurno).toHaveBeenCalledWith(61, true));
    expect(screen.getByLabelText(/Julio Ramos/)).toBeChecked();
  });

  it('si el servidor rechaza el cambio, lo dice y no marca la casilla', async () => {
    api.configurarAvisoTurno.mockRejectedValue({ mensaje: 'Solo Administración elige quién recibe estos avisos' });
    render(<TarjetaAvisosTurnos />);
    fireEvent.click(await screen.findByLabelText(/Sofía Quispe/));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo Administración elige quién recibe estos avisos');
    expect(screen.getByLabelText(/Sofía Quispe/)).toBeChecked();
  });

  it('sin personal muestra el estado vacío', async () => {
    api.avisosTurnos.mockResolvedValue([]);
    render(<TarjetaAvisosTurnos />);
    expect(await screen.findByText('No hay personal de Administración o Supervisión activo.')).toBeInTheDocument();
  });
});
