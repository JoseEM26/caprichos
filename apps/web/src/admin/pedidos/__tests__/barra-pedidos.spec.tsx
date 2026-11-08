import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({
  reproducirCampana: vi.fn(),
}));

describe('Barra de Pedidos y caja', () => {
  beforeEach(() => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
      permisos: ['caja/ver', 'pedidos/ver'],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
    vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 0, pagina: 1, limite: 100, items: [] } as any);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('la barra trae los 4 filtros, el buscador, Filtros y «Nuevo pedido» (más el botón flotante)', async () => {
    render(<PedidosAdminView />);

    const nuevo = await screen.findByRole('button', { name: 'Nuevo pedido' });
    const filtros = screen.getByRole('navigation', { name: 'Estado de los pedidos' });
    expect(within(filtros).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Todo0',
      'En preparación0',
      'Listos0',
      'A domicilio0',
    ]);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filtros/ })).toBeInTheDocument();
    expect(nuevo).toHaveClass('cj2-btn--nuevo');
    // Celular: botón flotante redondo con nombre accesible (la cabecera oculta el suyo con CSS)
    expect(screen.getByRole('button', { name: 'Agregar nuevo pedido' })).toHaveClass('cj2-fab');
    // Los combos viejos ya no están a la vista
    expect(screen.queryByRole('button', { name: /^Ver pedidos: / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mostrar: / })).not.toBeInTheDocument();
  });

  it('«Registrar cortesía» es secundario y en celular también está dentro de «Más acciones»', async () => {
    render(<PedidosAdminView />);

    await screen.findByRole('button', { name: 'Nuevo pedido' });
    expect(screen.getAllByRole('button', { name: 'Registrar cortesía' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Más acciones' }));
    expect(within(screen.getByRole('menu', { name: 'Más acciones' })).getByRole('menuitem', { name: 'Registrar cortesía' })).toBeInTheDocument();
  });
});
