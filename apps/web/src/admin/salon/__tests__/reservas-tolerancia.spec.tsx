import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReservasView } from '../ReservasView';
import { salonApi } from '../api';
import { hoyLima } from '../fechaLima';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: {
    obtenerMesas: vi.fn(),
    listarReservas: vi.fn(),
    calendario: vi.fn(),
    agenda: vi.fn(),
    listarSolicitudes: vi.fn(),
    aprobarSolicitud: vi.fn(),
    mesasOcupadas: vi.fn().mockResolvedValue([]),
    avisosMesas: vi.fn().mockResolvedValue([]),
    reactivarReserva: vi.fn(),
    cancelarReserva: vi.fn(),
    sentarReserva: vi.fn(),
    obtenerCarta: vi.fn(),
  },
}));

vi.mock('../audioAlerta', () => ({
  reproducirAvisoListo: vi.fn(),
}));

function pisosConMesas() {
  const mesa = (id: string, numero: number, asientos: number) => ({
    id,
    pisoId: 'p1',
    tipo: 'MESA',
    numero,
    nombre: `Mesa ${numero}`,
    asientos,
    x: 0,
    y: 0,
    ancho: 1,
    alto: 1,
    activo: true,
    estado: 'LIBRE',
  });
  return { pisos: [{ id: 'p1', nombre: 'Piso 1', activo: true, mesas: [mesa('1', 1, 4), mesa('2', 2, 2)] }] };
}

function simularSesionAdmin() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin Caprichos', rol: 'ADMIN' },
    permisos: ['*'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

/** Reserva de hoy a las 19:00 (Lima) en la mesa 1. */
const reservaHoy = (estado: string) => ({
  id: '5',
  nombre: 'Lucía Paredes',
  telefono: '987654321',
  personas: 2,
  hora: `${hoyLima()}T19:00:00-05:00`,
  tolerancia_min: 15,
  estado,
  motivo_cancelacion: null,
  pedido_id: null,
  mesas: [{ id: 'rm1', mesa_id: '1', numero: 1, nombre: 'Mesa 1', asientos: 4 }],
});

describe('Reservas: tolerancia, No llegó y aviso suave (Admin Salon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerMesas as any).mockResolvedValue(pisosConMesas());
    (salonApi.calendario as any).mockResolvedValue({ dias: {} });
    (salonApi.agenda as any).mockResolvedValue([]);
    (salonApi.listarSolicitudes as any).mockResolvedValue([]);
    (salonApi.avisosMesas as any).mockResolvedValue([]);
    (salonApi.mesasOcupadas as any).mockResolvedValue([]);
  });

  it('una reserva «No llegó» se muestra con ese estado y se puede reactivar (de hoy)', async () => {
    (salonApi.listarReservas as any).mockResolvedValue([reservaHoy('NO_ASISTIO')]);
    (salonApi.reactivarReserva as any).mockResolvedValue(reservaHoy('ACTIVA'));

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getAllByText('No llegó').length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText('Confirmada')).toHaveLength(0);

    const botones = screen.getAllByRole('button', { name: /^Reactivar$/i });
    fireEvent.click(botones[0]);

    await waitFor(() => {
      expect(salonApi.reactivarReserva).toHaveBeenCalledWith('5');
    });
    await waitFor(() => {
      expect(screen.queryAllByText('No llegó')).toHaveLength(0);
      expect(screen.getAllByText('Confirmada').length).toBeGreaterThan(0);
    });
  });

  it('una reserva activa no muestra Reactivar', async () => {
    (salonApi.listarReservas as any).mockResolvedValue([reservaHoy('ACTIVA')]);

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getAllByText('Lucía Paredes').length).toBeGreaterThan(0);
    });
    expect(screen.queryByRole('button', { name: /^Reactivar$/i })).not.toBeInTheDocument();
  });

  it('aviso suave al aprobar: muestra la otra reserva de la mesa, sin bloquear el botón', async () => {
    (salonApi.listarSolicitudes as any).mockResolvedValue([
      {
        id: '15',
        nombre: 'Renzo Palacios',
        telefono: '912345678',
        personas: 2,
        hora: '2099-12-20T19:30:00-05:00',
        estado: 'pendiente',
        mesa: 'Mesa 2 (Piso 1)',
        mesasIds: ['2'],
      },
    ]);
    (salonApi.avisosMesas as any).mockResolvedValue([
      'Esa mesa tiene otra reserva a las 18:30; puede seguir ocupada.',
    ]);

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getByText('Renzo Palacios')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i }));

    expect(await screen.findByText(/Esa mesa tiene otra reserva a las 18:30; puede seguir ocupada\./)).toBeInTheDocument();
    expect(salonApi.avisosMesas).toHaveBeenCalledWith('2099-12-20', '19:30', ['2']);
    expect(screen.getByRole('button', { name: /Sí, aprobar/i })).not.toBeDisabled();
  });
});
