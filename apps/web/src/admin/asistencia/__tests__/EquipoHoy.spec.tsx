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

describe('Equipo del día (pedido de cambio de turno)', () => {
  it('muestra quién trabaja con su horario, el reemplazo aprobado, los cambios y quién descansa', async () => {
    api.equipoHoy.mockResolvedValue(datos);
    render(<EquipoHoy fecha="2026-11-16" />);
    const trabajan = await screen.findByLabelText('Trabajan ese día');
    expect(within(trabajan).getByText('Ana Pérez cubre a Luis Gómez, 14:00–22:00')).toBeInTheDocument();
    expect(within(trabajan).getByText('Marta Ruiz, 08:00–16:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Cambios de turno de ese día')).toHaveTextContent('Ana Pérez y Luis Gómez cambiaron turno');
    const descansan = screen.getByLabelText('Descansan ese día');
    expect(descansan).toHaveTextContent('Rosa Vidal');
    expect(descansan).toHaveTextContent('Vacaciones o licencia');
  });

  it('sin turnos cargados muestra el estado vacío', async () => {
    api.equipoHoy.mockResolvedValue({ ...datos, trabajan: [], cambios: [], descansan: [] });
    render(<EquipoHoy fecha="2026-11-16" />);
    expect(await screen.findByText('Ese día no hay turnos cargados.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Trabajan ese día')).not.toBeInTheDocument();
  });

  it('si falla la carga lo dice sin bloquear la pantalla', async () => {
    api.equipoHoy.mockRejectedValue({ mensaje: 'Sin conexión' });
    render(<EquipoHoy fecha="2026-11-16" />);
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });

  it('pide el día elegido', async () => {
    api.equipoHoy.mockResolvedValue(datos);
    render(<EquipoHoy fecha="2026-11-20" />);
    await waitFor(() => expect(api.equipoHoy).toHaveBeenCalledWith('2026-11-20'));
    expect(screen.getByText('Quién trabaja el 2026-11-20')).toBeInTheDocument();
  });
});
