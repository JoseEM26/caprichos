import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { NotificacionesView } from '../NotificacionesView';
import * as api from '../notificacionesApi';

vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));

describe('NotificacionesView (/admin/notificaciones)', () => {
  const mockData = {
    metricas: {
      pendientesAhora: 2,
      urgentesAhora: 1,
      sinLeerHistorial: 3,
      delDiaDeHoy: 4,
      totalHistorial: 5,
      rolNombre: 'administrador',
    },
    pendientes: [
      {
        id: 'p1',
        titulo: 'La impresora de cocina no responde',
        detalle: 'Los tickets quedan en pantalla. Revisa el cable o el papel.',
        prioridad: 'ALTA' as const,
        desde: '2026-10-15T19:40:00Z',
        modulo: 'cocina',
        accion: 'Ir a Cocina',
        marcable: true,
      },
    ],
    conteosPorTipo: {
      Todos: 5,
      'Stock bajo': 2,
      'Error de impresora': 1,
      'Pedido por confirmar': 1,
      'Mensaje interno': 1,
    },
    conteosPorEstado: {
      todas: 5,
      nuevas: 3,
      leidas: 2,
    },
    items: [
      {
        id: '1',
        tipoCodigo: 'STOCK_BAJO',
        tipo: 'Stock bajo',
        titulo: 'Stock bajo',
        mensaje: 'Crema chantilly bajo el mínimo',
        enlace: null,
        leida: false,
        leidaEn: null,
        creadoEn: '2026-10-15T20:55:00Z',
        fecha: '15/10/2026',
        hora: '20:55',
        iso: '2026-10-15',
        color: '#C99A2E',
        modulo: 'stock',
        accion: 'Ver stock',
      },
      {
        id: '2',
        tipoCodigo: 'ERROR_IMPRESORA',
        tipo: 'Error de impresora',
        titulo: 'Error de impresora',
        mensaje: 'La impresora de cocina no responde',
        enlace: null,
        leida: true,
        leidaEn: '2026-10-15T21:00:00Z',
        creadoEn: '2026-10-15T19:40:00Z',
        fecha: '15/10/2026',
        hora: '19:40',
        iso: '2026-10-15',
        color: '#B5442E',
        modulo: 'mirest',
        accion: 'Ver configuración',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'listarHistorialNotificaciones').mockResolvedValue(mockData);
    vi.spyOn(api, 'marcarNotificacionLeida').mockResolvedValue({ ok: true, id: '1', leida: true });
    vi.spyOn(api, 'marcarTodasNotificacionesLeidas').mockResolvedValue({ ok: true });
    vi.spyOn(api, 'crearMensajeInterno').mockResolvedValue({ ok: true, id: '10' });
  });

  it('1. Renderiza métricas, pendientes e historial dinámicos', async () => {
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Pendientes ahora').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('La impresora de cocina no responde').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Crema chantilly bajo el mínimo')).toBeInTheDocument();
    });
  });

  it('2. Permite marcar una notificación como leída', async () => {
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Marcar como leída')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Marcar como leída'));

    await waitFor(() => {
      expect(api.marcarNotificacionLeida).toHaveBeenCalledWith('1', true);
    });
  });

  it('3. Abre el modal de nuevo mensaje interno y lo envía con confirmación', async () => {
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('+ Mensaje interno')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Mensaje interno'));

    expect(screen.getByPlaceholderText('Ejemplo: Cambio de turno o recordatorio')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Ejemplo: Cambio de turno o recordatorio'), {
      target: { value: 'Aviso de turno' },
    });
    fireEvent.change(screen.getByPlaceholderText('Escribe el detalle del comunicado...'), {
      target: { value: 'Turno de tarde inicia 15:00' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sí, enviar' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sí, enviar' }));

    await waitFor(() => {
      expect(api.crearMensajeInterno).toHaveBeenCalledWith({
        rol_destino: undefined,
        titulo: 'Aviso de turno',
        mensaje: 'Turno de tarde inicia 15:00',
      });
    });
  });

  it('4. Un pendiente guardado tiene el botón Leído; una alerta calculada no lo tiene', async () => {
    vi.spyOn(api, 'listarHistorialNotificaciones').mockResolvedValue({
      ...mockData,
      pendientes: [
        ...mockData.pendientes,
        {
          id: 'por-cobrar',
          titulo: '2 pedidos por cobrar',
          detalle: 'Pedidos activos que aún no tienen el cobro registrado.',
          prioridad: 'MEDIA' as const,
          desde: null,
          modulo: 'caja',
          accion: 'Ir a Pedidos y caja',
          marcable: false,
        },
      ],
    });
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('2 pedidos por cobrar')).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Leído' })).toHaveLength(1);
    const botones = screen.getAllByRole('button', { name: 'Leído' });
    for (const b of botones) {
      expect(b.getAttribute('style')).toContain('min-height: 44px');
    }
  });

  it('5. Leído pide confirmación Sí/No y, con Sí, marca el aviso como leído', async () => {
    render(
      <MemoryRouter>
        <NotificacionesView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Leído' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Leído' }));
    expect(api.marcarNotificacionLeida).not.toHaveBeenCalledWith('p1');

    fireEvent.click(screen.getByRole('button', { name: 'Sí, marcar leída' }));

    await waitFor(() => {
      expect(api.marcarNotificacionLeida).toHaveBeenCalledWith('p1');
    });
  });
});
