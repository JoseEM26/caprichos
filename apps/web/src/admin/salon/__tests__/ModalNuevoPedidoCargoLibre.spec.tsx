import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { continuarYEnviar, irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { llenarPagaCon } from './ayudaPagaCon';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn(), crearExtra: vi.fn() },
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
      productos: [{ id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 8.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};

function sesion(permisos: string[], rol = 'CAJERO') {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p), usuario: { rol } } as any);
}

/** Para llevar, con un café, en el paso 1 «Pedido». */
async function llegarAProductos(canal: 'CAJA' | 'MOZO') {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" canal={canal} />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
}

describe('Nuevo pedido ▸ + Servicio o producto (Caja y mozo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: 'ped-9', codigo: 'CP-W009', estado: 'COLA', total: 12 } as any);
  });

  it.each(['CAJA', 'MOZO'] as const)('%s: agrega el cargo, suma al total y lo envía con el producto elegido', async (canal) => {
    sesion(['pedidos/cargo_libre'], canal === 'CAJA' ? 'CAJERO' : 'MOZO');
    await llegarAProductos(canal);
    fireEvent.click(await screen.findByTestId('btn-cargo-libre'));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Texto: Feliz cumple Ana' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '3.50' } });
    const para = screen.getByLabelText(/¿Para qué producto/) as HTMLSelectElement;
    fireEvent.change(para, { target: { value: para.options[1].value } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(screen.getByTestId('cargo-libre-fila')).toHaveTextContent('Servicio/producto libre · Texto: Feliz cumple Ana (para Café Americano)');
    expect(screen.getByTestId('fila-cargos-libres')).toHaveTextContent('S/ 3.50');
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveTextContent('S/ 12.00');

    irAlPago();
    llenarPagaCon();
    continuarYEnviar();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ cargosLibres: [{ descripcion: 'Texto: Feliz cumple Ana', monto: 3.5, paraLineaIndex: 0 }] }),
      expect.any(String),
    );
  });

  it('se puede quitar el cargo antes de enviar y el total vuelve', async () => {
    sesion(['pedidos/cargo_libre']);
    await llegarAProductos('CAJA');
    fireEvent.click(await screen.findByTestId('btn-cargo-libre'));
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Topping' } });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveTextContent('S/ 10.50');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Topping' }));
    expect(screen.queryByTestId('cargo-libre-fila')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveTextContent('S/ 8.50');
  });

  it('sin el permiso no aparece el botón', async () => {
    sesion([]);
    await llegarAProductos('CAJA');
    await screen.findByRole('button', { name: 'Continuar' });
    expect(screen.queryByTestId('btn-cargo-libre')).toBeNull();
  });
});
