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

describe('Filtros de Reservas en combo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerMesas as any).mockResolvedValue([]);
    (salonApi.calendario as any).mockResolvedValue({ dias: {} });
    (salonApi.agenda as any).mockResolvedValue([]);
    (salonApi.listarReservas as any).mockResolvedValue([]);
    (salonApi.listarSolicitudes as any).mockResolvedValue([]);
    simularSesionAdmin();
  });

  it('Estado y Personas se eligen en combos dentro de Filtros, sin fila de botones', async () => {
    render(<ReservasView />);
    await waitFor(() => expect(salonApi.listarReservas).toHaveBeenCalled());

    expect(screen.queryByRole('button', { name: 'Confirmada' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByRole('button', { name: 'Estado: Todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personas: Todas' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Personas: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: '4 personas' }));
    expect(screen.getByRole('button', { name: 'Personas: 4 personas' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'Cancelada' }));
    expect(screen.getByRole('button', { name: 'Estado: Cancelada' })).toBeInTheDocument();
  });
});
