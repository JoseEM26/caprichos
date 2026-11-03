import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn() },
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn() },
}));

const cartaMock = {
  categorias: [
    {
      id: 'cat-1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [
        { id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null },
      ],
    },
  ],
};

/** Alta desde «¿Qué vas a hacer?» (Pedidos y caja) para llevar, con un café. */
async function llegarAResumenLlevar() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  await screen.findByRole('group', { name: 'Comprobante' });
}

describe('Nuevo pedido en Caja: comprobante', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: 'ped-9', codigo: 'CP-W009', estado: 'COLA', total: 8.5 } as any);
  });

  it('con factura envía el RUC, la razón social y la dirección al crear', async () => {
    await llegarAResumenLlevar();
    fireEvent.click(screen.getByTestId('comprobante-FACTURA'));
    fireEvent.change(screen.getByLabelText('RUC'), { target: { value: '20123456789' } });
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Acme SAC' } });
    fireEvent.change(screen.getByLabelText('Dirección fiscal (opcional)'), { target: { value: 'Av. Uno 123' } });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));

    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        comprobante: { tipo: 'FACTURA', ruc: '20123456789', razonSocial: 'Acme SAC', direccion: 'Av. Uno 123' },
      }),
      expect.any(String),
    );
  });

  it('sin elegir boleta o factura no registra: el selector es obligatorio', async () => {
    await llegarAResumenLlevar();
    const grupo = screen.getByRole('group', { name: 'Comprobante' });
    expect(within(grupo).getByTestId('comprobante-BOLETA').getAttribute('aria-pressed')).toBe('false');
    expect(within(grupo).getByTestId('comprobante-FACTURA').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /Nota de venta|Sin elegir/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    expect(screen.queryByRole('button', { name: 'Sí, registrar' })).toBeNull();
    expect(pedidosApi.crearPedidoAdmin).not.toHaveBeenCalled();

    fireEvent.click(within(grupo).getByTestId('comprobante-BOLETA'));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0]).toHaveProperty('comprobante', { tipo: 'BOLETA' });
  });

  it('un RUC de 10 dígitos muestra el error y no registra el pedido', async () => {
    await llegarAResumenLlevar();
    fireEvent.click(screen.getByTestId('comprobante-FACTURA'));
    fireEvent.change(screen.getByLabelText('RUC'), { target: { value: '1234567890' } });
    expect(screen.getByText(/El RUC debe tener 11 dígitos/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    expect(screen.queryByRole('button', { name: 'Sí, registrar' })).toBeNull();
    expect(pedidosApi.crearPedidoAdmin).not.toHaveBeenCalled();
    expect(within(screen.getByRole('group', { name: 'Comprobante' })).getByTestId('comprobante-FACTURA').getAttribute('aria-pressed')).toBe('true');
  });
});
