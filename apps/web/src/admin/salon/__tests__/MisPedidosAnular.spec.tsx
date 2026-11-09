import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';

// Orden del dueño 08/11: el mozo anula sus pedidos desde Mis pedidos (con motivo y confirmación Sí/No)
const permisos = new Set(['pedidos/anular', 'pedidos/extra']);
vi.mock('../../../comun/sesion', () => ({
  useSesion: () => ({ usuario: { rol: 'MOZO', partyId: '7' }, tiene: (p: string) => permisos.has(p) }),
}));
vi.mock('../api', () => ({ salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() } }));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({ ModalNuevoPedidoMesa: () => null }));

const linea = { id: '1', nombre: 'Café', cantidad: 1, tamano: null, opciones: [], nota: null, precioUnit: 5, subtotal: 5, lista: false };

describe('Mis pedidos: anular pedido propio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permisos.add('pedidos/anular');
    vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] } as any);
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [{ id: '11', codigo: 'CP-M011', estado: 'PREPARANDO', modalidad: 'MESA', mesaNombre: 'Mesa 3', total: 5, pagoEstado: 'PENDIENTE', creadoEn: '2026-10-29T15:10:00Z', lineas: [linea] }],
      resumen: { cantidad: 1, total: 5, enCurso: 1, entregados: 0 },
    } as any);
  });

  it('el pedido en curso ofrece «Anular pedido» y pide motivo y confirmación', async () => {
    render(<MisPedidosView />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    fireEvent.click(await screen.findByRole('tab', { name: /Estado y acciones/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Anular pedido' }));
    expect(screen.getByText(/pedido COMPLETO, con todas sus áreas/)).toBeInTheDocument();
    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'Cliente se fue' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/ }));
    await waitFor(() => expect(pedidosApi.cambiarEstado).toHaveBeenCalledWith('11', 'ANULADO', 'Cliente se fue'));
  });

  it('sin el permiso pedidos/anular no hay botón', async () => {
    permisos.delete('pedidos/anular');
    render(<MisPedidosView />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ver detalle' }))[0]);
    fireEvent.click(await screen.findByRole('tab', { name: /Estado y acciones/ }));
    await within(screen.getByRole('dialog')).findByRole('button', { name: '+ Pedido extra' });
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).toBeNull();
  });
});
