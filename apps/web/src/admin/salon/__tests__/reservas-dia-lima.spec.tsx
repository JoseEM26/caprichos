import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReservasView } from '../ReservasView';
import { salonApi } from '../api';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: {
    obtenerMesas: vi.fn(),
    calendario: vi.fn(),
    agenda: vi.fn(),
    listarReservas: vi.fn(),
    listarSolicitudes: vi.fn(),
  },
}));

vi.mock('../audioAlerta', () => ({
  reproducirAvisoListo: vi.fn(),
}));

function simularSesionAdmin() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
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

// El API serializa la hora como ISO en UTC (toISOString), igual que aquí.
const reserva = (id: string, nombre: string, horaLima: string) => ({
  id,
  nombre,
  telefono: '900000000',
  personas: 2,
  hora: new Date(horaLima).toISOString(),
  estado: 'ACTIVA',
  tolerancia_min: 15,
  motivo_cancelacion: null,
  pedido_id: null,
  mesas: [],
});

describe('Reservas: día y hora en zona America/Lima', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 2026-11-04 12:00 en Lima (17:00 UTC): «hoy» es el 4 en Lima.
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T17:00:00.000Z'));

    (salonApi.obtenerMesas as any).mockResolvedValue({ pisos: [] });
    (salonApi.calendario as any).mockResolvedValue({ dias: {} });
    (salonApi.agenda as any).mockResolvedValue([]);
    (salonApi.listarSolicitudes as any).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // El día seleccionado es hoy en Lima (4). La lista del día muestra «No hay reservas para este día.» si no cae ninguna.
  it.each([
    ['19:00', '2026-11-04T19:00:00-05:00', 'Cena Temprana'],
    ['23:30', '2026-11-04T23:30:00-05:00', 'Noche Tardia'],
  ])('una reserva de %s Lima aparece en el día de Lima', async (_etiqueta, hora, nombre) => {
    (salonApi.listarReservas as any).mockResolvedValue([reserva('101', nombre, hora)]);

    simularSesionAdmin();
    render(<ReservasView />);

    await waitFor(() => expect(screen.getAllByText(nombre).length).toBeGreaterThan(0));
    expect(screen.queryByText('No hay reservas para este día.')).not.toBeInTheDocument();
  });
});
