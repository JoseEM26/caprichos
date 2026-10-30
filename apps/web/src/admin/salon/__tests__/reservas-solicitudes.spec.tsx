import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReservasView } from '../ReservasView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: {
    obtenerPlano: vi.fn(),
    actualizarPiso: vi.fn(),
    crearElemento: vi.fn(),
    actualizarElemento: vi.fn(),
    girarElemento: vi.fn(),
    eliminarElemento: vi.fn(),
    obtenerDiseno: vi.fn(),
    aplicarDiseno: vi.fn(),
    obtenerMesas: vi.fn(),
    abrirPedidoMesa: vi.fn(),
    liberarMesaManual: vi.fn(),
    marcarEntregadoMesa: vi.fn(),
    listarReservas: vi.fn(),
    calendario: vi.fn(),
    agenda: vi.fn(),
    crearReserva: vi.fn(),
    actualizarReserva: vi.fn(),
    cancelarReserva: vi.fn(),
    sentarReserva: vi.fn(),
    obtenerCarta: vi.fn(),
    listarSolicitudes: vi.fn(),
    aprobarSolicitud: vi.fn(),
    rechazarSolicitud: vi.fn(),
  },
}));

vi.mock('../audioAlerta', () => ({
  reproducirAvisoListo: vi.fn(),
}));

function simularSesionAdmin() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: {
      partyId: '1',
      nombres: 'Admin Caprichos',
      rol: 'ADMIN',
    },
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

describe('Gestión de Solicitudes de Reserva por WhatsApp (Admin Salon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (salonApi.obtenerMesas as any).mockResolvedValue([
      { id: '1', numero: 1, nombre: 'Mesa 1', asientos: 4, activo: true, estado: 'LIBRE' },
      { id: '2', numero: 2, nombre: 'Mesa 2', asientos: 2, activo: true, estado: 'LIBRE' },
    ]);

    (salonApi.calendario as any).mockResolvedValue({
      dias: {},
    });

    (salonApi.agenda as any).mockResolvedValue([]);
    (salonApi.listarReservas as any).mockResolvedValue([]);
  });

  it('muestra las solicitudes pendientes de WhatsApp en la vista de reservas', async () => {
    (salonApi.listarSolicitudes as any).mockResolvedValue([
      {
        id: '10',
        nombre: 'Valeria Gómez',
        telefono: '998877665',
        personas: 3,
        hora: '2026-10-30T20:00:00-05:00',
        estado: 'pendiente',
        mesa: 'Mesa 1 (Piso 1)',
      },
    ]);

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getByText('Valeria Gómez')).toBeInTheDocument();
      expect(screen.getByText(/Solicitudes por WhatsApp/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Rechazar$/i })).toBeInTheDocument();
    });
  });

  it('exige confirmación Sí/No antes de aprobar y llama a aprobarSolicitud', async () => {
    (salonApi.listarSolicitudes as any).mockResolvedValue([
      {
        id: '15',
        nombre: 'Renzo Palacios',
        telefono: '912345678',
        personas: 2,
        hora: '19:30',
        fechaTexto: '2026-10-30',
        estado: 'pendiente',
        mesa: 'Mesa 2 (Piso 1)',
        mesasIds: ['2'],
      },
    ]);
    (salonApi.aprobarSolicitud as any).mockResolvedValue({
      solicitud: { id: '15', estado: 'aprobada' },
      reserva: { id: '100' },
    });

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getByText('Renzo Palacios')).toBeInTheDocument();
    });

    const botonAprobar = screen.getByRole('button', { name: /Aprobar y guardar la mesa/i });
    fireEvent.click(botonAprobar);

    // Debe aparecer diálogo de confirmación obligatoria Sí/No
    expect(screen.getByText(/¿Aprobar la reserva de Renzo Palacios\?/i)).toBeInTheDocument();
    const btnSi = screen.getByRole('button', { name: /Sí, aprobar/i });
    const btnNo = screen.getByRole('button', { name: /No, cancelar/i });
    expect(btnSi).toBeInTheDocument();
    expect(btnNo).toBeInTheDocument();

    // Confirmar
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(salonApi.aprobarSolicitud).toHaveBeenCalledWith('15', { mesas: ['2'] });
    });
  });

  it('permite cancelar el diálogo de aprobación sin llamar al backend', async () => {
    (salonApi.listarSolicitudes as any).mockResolvedValue([
      {
        id: '20',
        nombre: 'Carla Vega',
        telefono: '923456789',
        personas: 4,
        hora: '21:00',
        estado: 'pendiente',
      },
    ]);

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getByText('Carla Vega')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i }));
    expect(screen.getByText(/¿Aprobar la reserva de Carla Vega\?/i)).toBeInTheDocument();

    const btnNo = screen.getByRole('button', { name: /No, cancelar/i });
    fireEvent.click(btnNo);

    expect(salonApi.aprobarSolicitud).not.toHaveBeenCalled();
    expect(screen.queryByText(/¿Aprobar la reserva de Carla Vega\?/i)).not.toBeInTheDocument();
  });

  it('exige confirmación Sí/No antes de rechazar y llama a rechazarSolicitud', async () => {
    (salonApi.listarSolicitudes as any).mockResolvedValue([
      {
        id: '25',
        nombre: 'Gustavo Prado',
        telefono: '934567890',
        personas: 5,
        hora: '14:00',
        estado: 'pendiente',
      },
    ]);
    (salonApi.rechazarSolicitud as any).mockResolvedValue({
      id: '25',
      estado: 'rechazada',
    });

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => {
      expect(screen.getByText('Gustavo Prado')).toBeInTheDocument();
    });

    const botonRechazar = screen.getByRole('button', { name: /^Rechazar$/i });
    fireEvent.click(botonRechazar);

    expect(screen.getByText(/¿Rechazar la solicitud de Gustavo Prado\?/i)).toBeInTheDocument();
    const btnSiRechazar = screen.getByRole('button', { name: /Sí, rechazar/i });
    expect(btnSiRechazar).toBeInTheDocument();

    fireEvent.click(btnSiRechazar);

    await waitFor(() => {
      expect(salonApi.rechazarSolicitud).toHaveBeenCalledWith('25', {
        motivo: 'No hay mesa disponible en el horario solicitado',
      });
    });
  });
});
