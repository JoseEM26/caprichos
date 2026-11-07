import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../vouchers/vouchersApi', () => ({ vouchersApi: { subirVoucher: vi.fn() } }));
vi.mock('../../../comun/api', async (orig) => ({
  ...(await orig<typeof import('../../../comun/api')>()),
  api: { post: vi.fn(), get: vi.fn() },
}));

const carta = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [{ id: 'prod-1', nombre: 'Café Americano', descripcion: '', fotoUrl: null, precio: 20, tamanos: [], grupos: [], activo: true, disponible: true }],
    },
  ],
};

describe('ModalNuevoPedidoMesa: promoción automática del local', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('para llevar con 25 % automático: pide la vista previa al servidor y el total sale con el descuento', async () => {
    vi.mocked(api.post).mockResolvedValue({ descuentoTotal: 5 });
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/ofertas/vista-previa', {
        canal: 'CAJA',
        codigo: undefined,
        lineas: [{ productoId: 'prod-1', cantidad: 1, subtotal: 20, precioUnitario: 20 }],
      }),
    );
    expect(await screen.findByText('- S/ 5.00')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 15.00').length).toBeGreaterThan(0);
  });
});
