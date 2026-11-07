import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';

// MOZO: tiene pedidos/anular pero no pedidos/cambiar_estado
const permisos = new Set(['pedidos/anular']);
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: 'MOZO', partyId: '7' }, tiene: (p: string) => permisos.has(p) }),
}));
vi.mock('../api', () => ({ salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() } }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({ ModalNuevoPedidoMesa: () => null }));

const linea = { id: '1', nombre: 'Café', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 5, subtotal: 5, lista: false };
const pedido = (id: string, estado: string, pagoEstado: string) => ({
  id, codigo: `CP-M0${id}`, estado, modalidad: 'MESA', mesaNombre: 'Mesa 3', total: 5, pagoEstado,
  creadoEn: '2026-10-29T15:10:00Z', lineas: [linea],
});

describe('Mis pedidos: anular el pedido propio sin código', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [pedido('11', 'PREPARANDO', 'PENDIENTE'), pedido('12', 'ENTREGADO', 'PAGADO')],
      resumen: { cantidad: 2, total: 10, enCurso: 1, entregados: 1 },
    } as any);
  });

  it('el botón sale solo en el pedido en curso sin cobro; el modal no pide código y anula', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    render(<MisPedidosView />);
    const detalles = await screen.findAllByRole('button', { name: 'Ver detalle' });
    // Solo un detalle abierto a la vez: el entregado y pagado no ofrece anular
    fireEvent.click(detalles[1]);
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));

    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    expect(screen.getByText(/pedido COMPLETO/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'El cliente se fue' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/ }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('11', 'ANULADO', 'El cliente se fue', ''));
  });

  it('sin el permiso pedidos/anular no hay botón', async () => {
    permisos.clear();
    render(<MisPedidosView />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).toBeNull();
    permisos.add('pedidos/anular');
  });
});
