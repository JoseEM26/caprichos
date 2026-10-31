import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

  it('«Mostrar» y «Ver pedidos» están en la misma barra, lado a lado', async () => {
    render(<PedidosAdminView />);

    const mostrar = await screen.findByRole('button', { name: /^Mostrar: / });
    const verPedidos = screen.getByRole('button', { name: /^Ver pedidos: / });
    const barra = mostrar.closest('.cj-barra');

    expect(barra).not.toBeNull();
    expect(barra).toContainElement(verPedidos);
    expect(barra).toContainElement(screen.getByRole('button', { name: 'Nuevo pedido' }));
  });
});
