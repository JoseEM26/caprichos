import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ equipoHoy: vi.fn() }));
vi.mock('../turnosApi', async (orig) => ({
  ...(await orig<typeof import('../turnosApi')>()),
  equipoHoy: (...a: any[]) => api.equipoHoy(...a),
}));

import { EquipoHoy } from '../EquipoHoy';

const datos = {
  jornada: '2026-11-16',
  ahora: '2026-11-16T15:00:00.000Z',
  trabajan: [
    { partyId: 10, nombre: 'Marta Ruiz', area: 'Salado', desde: '08:00', hasta: '16:00', cubreA: [], cubiertoParcialmentePor: [] },
    { partyId: 2, nombre: 'Ana Pérez', area: 'Mozo', desde: '14:00', hasta: '22:00', cubreA: ['Luis Gómez'], cubiertoParcialmentePor: [] },
  ],
  cambios: [{ texto: 'Ana Pérez y Luis Gómez cambiaron turno' }],
  descansan: [{ partyId: 3, nombre: 'Rosa Vidal', area: 'Caja', motivo: 'Día libre' }, { partyId: 4, nombre: 'Pedro Díaz', area: 'Mozo', motivo: 'Vacaciones o licencia' }],
};

beforeEach(() => { api.equipoHoy.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('Equipo de hoy (Mi asistencia)', () => {
  it('muestra quién trabaja con su horario, el reemplazo aprobado, los cambios y quién descansa', async () => {
    api.equipoHoy.mockResolvedValue(datos);
    render(<EquipoHoy />);
    const trabajan = await screen.findByLabelText('Trabajan hoy');
    expect(within(trabajan).getByText('Ana Pérez cubre a Luis Gómez, 14:00–22:00')).toBeInTheDocument();
    expect(within(trabajan).getByText('Marta Ruiz, 08:00–16:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Cambios de turno de hoy')).toHaveTextContent('Ana Pérez y Luis Gómez cambiaron turno');
    const descansan = screen.getByLabelText('Hoy descansan');
    expect(descansan).toHaveTextContent('Rosa Vidal');
    expect(descansan).toHaveTextContent('Vacaciones o licencia');
  });

  it('sin turnos cargados muestra el estado vacío', async () => {
    api.equipoHoy.mockResolvedValue({ ...datos, trabajan: [], cambios: [], descansan: [] });
    render(<EquipoHoy />);
    expect(await screen.findByText('Hoy no hay turnos cargados.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Trabajan hoy')).not.toBeInTheDocument();
  });

  it('si falla la carga lo dice sin bloquear la pantalla', async () => {
    api.equipoHoy.mockRejectedValue({ mensaje: 'Sin conexión' });
    render(<EquipoHoy />);
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });

  it('se refresca solo cada pocos minutos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.equipoHoy.mockResolvedValue(datos);
    render(<EquipoHoy />);
    await waitFor(() => expect(api.equipoHoy).toHaveBeenCalledTimes(1));
    vi.advanceTimersByTime(3 * 60_000 + 10);
    await waitFor(() => expect(api.equipoHoy).toHaveBeenCalledTimes(2));
  });
});
