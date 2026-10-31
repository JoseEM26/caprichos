import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));

const AHORA = new Date('2026-10-29T03:00:00Z');

const pedido = (codigo: string, canal: string, modalidad: string) => ({
  id: codigo,
  codigo,
  canal,
  modalidad,
  estado: 'NUEVO',
  pago_estado: 'PENDIENTE',
  cliente_nombre: `Cliente ${codigo}`,
  subtotal: 10,
  descuento: 0,
  total: 10,
  creado_en: '2026-10-28T20:00:00Z',
  lineas: [],
  historial: [],
});

describe('Filtros desplegables de Pedidos y caja (canal, modalidad y cobro)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['caja/ver', 'pedidos/ver'],
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
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
    vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
      if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
      return {
        total: 3,
        pagina: 1,
        limite: 100,
        items: [pedido('CP-WEB', 'CARTA', 'LLEVAR'), pedido('CP-WA', 'BOT', 'DELIVERY'), pedido('CP-CAJA', 'CAJA', 'MESA')],
      } as any;
    });
  });

  afterEach(() => {
    // Desmontar antes de restaurar los mocks: nada se vuelve a pintar con los hooks reales
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('el canal se elige en un combo dentro de Filtros y filtra la lista', async () => {
    render(<PedidosAdminView />);
    await screen.findByText('CP-WEB');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    expect(screen.getByRole('button', { name: 'Canal: Todos' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Canal: Todos' }));
    fireEvent.click(screen.getByRole('option', { name: 'WhatsApp' }));

    expect(screen.getByRole('button', { name: 'Canal: WhatsApp' })).toBeInTheDocument();
    expect(screen.getAllByText('CP-WA').length).toBeGreaterThan(0);
    expect(screen.queryByText('CP-WEB')).not.toBeInTheDocument();
    expect(screen.queryByText('CP-CAJA')).not.toBeInTheDocument();
  });

  it('la modalidad es un combo independiente del canal', async () => {
    render(<PedidosAdminView />);
    await screen.findByText('CP-WEB');

    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Modalidad: Todas' }));
    fireEvent.click(screen.getByRole('option', { name: 'Delivery' }));

    expect(screen.getByRole('button', { name: 'Modalidad: Delivery' })).toBeInTheDocument();
    expect(screen.getAllByText('CP-WA').length).toBeGreaterThan(0);
    expect(screen.queryByText('CP-WEB')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Canal: Todos' })).toBeInTheDocument();
  });
});
