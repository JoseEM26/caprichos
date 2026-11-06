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
    reactivarReserva: vi.fn(),
    avisosMesas: vi.fn().mockResolvedValue([]),
    obtenerCarta: vi.fn(),
    listarSolicitudes: vi.fn(),
    aprobarSolicitud: vi.fn(),
    mesasOcupadas: vi.fn().mockResolvedValue([]),
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

describe('Mapa del salón en Reservas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (salonApi.obtenerMesas as any).mockResolvedValue(pisosConMesas());
    (salonApi.calendario as any).mockResolvedValue({ dias: {} });
    (salonApi.agenda as any).mockResolvedValue([]);
    (salonApi.listarReservas as any).mockResolvedValue([]);
    (salonApi.listarSolicitudes as any).mockResolvedValue([]);
    (salonApi.obtenerPlano as any).mockResolvedValue([
      {
        id: 'p1',
        nombre: 'Piso 1',
        elementos: [
          { id: 'pared-1', pisoId: 'p1', tipo: 'PARED', x: 5, y: 5, ancho: 4, alto: 1, activo: true },
          { id: 'barra-1', pisoId: 'p1', tipo: 'BARRA', x: 8, y: 8, ancho: 4, alto: 2, activo: true },
        ],
      },
    ]);
  });

  it('el croquis de la reserva nueva dibuja pared y barra además de las mesas', async () => {
    simularSesionAdmin();
    render(<ReservasView />);
    await waitFor(() => expect(salonApi.obtenerPlano).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /Nueva reserva/i }));
    expect(await screen.findByTestId('selector-mesas-croquis')).toBeInTheDocument();
    expect(await screen.findByTestId('elemento-plano-pared-1')).toBeInTheDocument();
    expect(screen.getByTestId('elemento-plano-barra-1')).toBeInTheDocument();
    expect(screen.getByTestId('elemento-plano-1')).toBeInTheDocument();
  });

  it('si falla la carga avisa «No se pudo cargar el mapa» y Reintentar vuelve a pedirlo', async () => {
    (salonApi.obtenerPlano as any).mockRejectedValueOnce(new Error('403'));
    simularSesionAdmin();
    render(<ReservasView />);
    expect(await screen.findByText(/No se pudo cargar el mapa/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reintentar/i }));
    await waitFor(() => expect(screen.queryByText(/No se pudo cargar el mapa/i)).not.toBeInTheDocument());
    expect(salonApi.obtenerPlano).toHaveBeenCalledTimes(2);
  });
});
