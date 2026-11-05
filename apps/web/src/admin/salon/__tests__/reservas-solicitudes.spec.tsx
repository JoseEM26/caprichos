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

/** Respuesta de /admin/salon/mesas: dos mesas activas en un piso. */
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
  return {
    pisos: [
      {
        id: 'p1',
        nombre: 'Piso 1',
        activo: true,
        mesas: [mesa('1', 1, 4), mesa('2', 2, 2)],
      },
    ],
  };
}

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

    (salonApi.obtenerMesas as any).mockResolvedValue(pisosConMesas());

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
        hora: '2099-12-20T19:30:00-05:00',
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
      expect(salonApi.aprobarSolicitud).toHaveBeenCalledWith('15', {
        mesas: ['2'],
        hora: '2099-12-20T19:30:00-05:00',
      });
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

  describe('aprobar o rechazar con error: la pantalla no se reemplaza', () => {
    const solicitudFutura = (extra: Record<string, unknown> = {}) => ({
      id: '40',
      nombre: 'Marta Quispe',
      telefono: '955443322',
      personas: 2,
      hora: '2099-12-20T19:00:00-05:00',
      estado: 'pendiente',
      ...extra,
    });

    it('si el API rechaza la aprobación, el error va dentro del diálogo y no aparece «Error al cargar reservas»', async () => {
      (salonApi.listarSolicitudes as any).mockResolvedValue([solicitudFutura({ mesasIds: ['1'] })]);
      (salonApi.aprobarSolicitud as any).mockRejectedValue(
        new Error('La hora solicitada ya pasó. Elige una hora nueva para aprobar la reserva.'),
      );

      simularSesionAdmin();
      render(<ReservasView />);
      await waitFor(() => expect(screen.getByText('Marta Quispe')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, aprobar/i }));

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('La hora solicitada ya pasó. Elige una hora nueva para aprobar la reserva.');
      expect(screen.queryByText('Error al cargar reservas')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /¿Aprobar la reserva de Marta Quispe\?/i })).toBeInTheDocument();
      expect(screen.getByText(/Solicitudes por WhatsApp/i)).toBeInTheDocument();
    });

    it('si el API rechaza el rechazo, el error queda dentro del diálogo y la pantalla sigue', async () => {
      (salonApi.listarSolicitudes as any).mockResolvedValue([solicitudFutura()]);
      (salonApi.rechazarSolicitud as any).mockRejectedValue(new Error('Motivo no válido'));

      simularSesionAdmin();
      render(<ReservasView />);
      await waitFor(() => expect(screen.getByText('Marta Quispe')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /^Rechazar$/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, rechazar/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Motivo no válido');
      expect(screen.queryByText('Error al cargar reservas')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /¿Rechazar la solicitud de Marta Quispe\?/i })).toBeInTheDocument();
    });
  });

  describe('modal de aprobación: mesa y hora', () => {
    it('sin mesa elegida el botón está deshabilitado y dice «Elige una mesa»', async () => {
      (salonApi.listarSolicitudes as any).mockResolvedValue([
        { id: '41', nombre: 'Tomás Ríos', telefono: '966554433', personas: 2, hora: '2099-12-20T20:00:00-05:00', estado: 'pendiente' },
      ]);

      simularSesionAdmin();
      render(<ReservasView />);
      await waitFor(() => expect(screen.getByText('Tomás Ríos')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i }));

      const btnElegir = screen.getByRole('button', { name: 'Elige una mesa' });
      expect(btnElegir).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: /Mesa 1/ }));
      const btnSi = screen.getByRole('button', { name: 'Sí, aprobar' });
      expect(btnSi).toBeEnabled();
      fireEvent.click(btnSi);

      await waitFor(() => {
        expect(salonApi.aprobarSolicitud).toHaveBeenCalledWith('41', {
          mesas: ['1'],
          hora: '2099-12-20T20:00:00-05:00',
        });
      });
    });

    it('si la hora solicitada ya pasó, lo avisa, exige una hora futura y envía la nueva', async () => {
      (salonApi.listarSolicitudes as any).mockResolvedValue([
        { id: '42', nombre: 'Elena Vidal', telefono: '977665544', personas: 2, hora: '2020-01-01T01:00:00.000Z', estado: 'pendiente', mesasIds: ['2'] },
      ]);
      (salonApi.aprobarSolicitud as any).mockResolvedValue({ solicitud: { id: '42' }, reserva: { id: '9' } });

      simularSesionAdmin();
      render(<ReservasView />);
      await waitFor(() => expect(screen.getByText('Elena Vidal')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /Aprobar y guardar la mesa/i }));

      expect(screen.getByRole('status')).toHaveTextContent(
        'La hora solicitada ya pasó. Elige una hora nueva para aprobar o rechaza la solicitud.',
      );
      expect(screen.getByRole('button', { name: 'Elige una hora futura' })).toBeDisabled();

      fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2099-12-21' } });
      fireEvent.change(screen.getByLabelText('Hora (Lima)'), { target: { value: '18:30' } });

      const btnSi = screen.getByRole('button', { name: 'Sí, aprobar' });
      expect(btnSi).toBeEnabled();
      fireEvent.click(btnSi);

      await waitFor(() => {
        expect(salonApi.aprobarSolicitud).toHaveBeenCalledWith('42', {
          mesas: ['2'],
          hora: '2099-12-21T18:30:00-05:00',
        });
      });
    });
  });
});
