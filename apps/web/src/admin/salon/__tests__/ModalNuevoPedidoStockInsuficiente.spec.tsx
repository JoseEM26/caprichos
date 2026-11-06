import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { ErrorApi } from '../../../comun/api';
import { leerStockInsuficiente, mensajeStockInsuficiente } from '../../pedidos/stockInsuficiente';

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

async function llegarAResumenLlevar(alCerrar = vi.fn()) {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={alCerrar} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  await screen.findByRole('group', { name: 'Comprobante' });
  fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
}

describe('Nuevo pedido: STOCK_INSUFICIENTE al registrar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('muestra «Solo quedan N de <producto>» y deja el modal abierto', async () => {
    const alCerrar = vi.fn();
    vi.mocked(pedidosApi.crearPedidoAdmin).mockRejectedValue(
      new ErrorApi('STOCK_INSUFICIENTE', 'Sin stock suficiente', 409, {
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Sin stock suficiente',
        productoId: 'prod-1',
        quedan: 2,
      }),
    );
    await llegarAResumenLlevar(alCerrar);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Solo quedan 2 de Café Americano');
    expect(alerta).toHaveTextContent('El pedido sigue igual');
    expect(alCerrar).not.toHaveBeenCalled();
  });
});

describe('mensajes de STOCK_INSUFICIENTE', () => {
  it('lee el 409 y arma el texto en singular, plural y agotado', () => {
    const err = new ErrorApi('STOCK_INSUFICIENTE', 'x', 409, { productoId: 'p9', quedan: 1 });
    const datos = leerStockInsuficiente(err);
    expect(datos).toEqual({ productoId: 'p9', quedan: 1 });
    expect(mensajeStockInsuficiente(datos!, 'Dona')).toContain('Solo queda 1 de Dona');
    expect(mensajeStockInsuficiente({ productoId: 'p9', quedan: 0 }, 'Dona')).toContain('Ya no queda Dona');
    expect(leerStockInsuficiente(new ErrorApi('OTRO', 'x', 400))).toBeNull();
  });
});
