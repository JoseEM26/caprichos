import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { ErrorApi } from '../../../comun/api';
import type { ProductoCarta } from '../../../carta/tipos';

vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../pedidos/pedidosApi', () => ({
  pedidosApi: { crearPedidoAdmin: vi.fn() },
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn() },
}));

const dona: ProductoCarta = {
  id: 'dona-1',
  nombre: 'Dona glaseada',
  descripcion: null,
  fotoUrl: null,
  precio: 18,
  tamanos: [
    { id: 'media', nombre: 'Media docena', precio: 18, unidades: 6 },
    { id: 'docena', nombre: 'Docena', precio: 34, unidades: 12 },
  ],
  grupos: [],
  sabores: [
    { id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 },
    { id: 'o', nombre: 'Oreo', disponible: true, quedan: null },
    { id: 'm', nombre: 'Manjar', disponible: true, quedan: 1 },
  ],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: true,
  quedan: null,
  saboresConStock: true,
};

const cartaMock = {
  categorias: [{ id: 'cat-1', nombre: 'Donas', orden: 1, productos: [dona] }],
};

describe('VentanaOpcionesProducto con mezcla de sabores', () => {
  it('muestra el selector, bloquea Agregar hasta repartir el tamaño y envía sabores y unidades por mezcla', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={dona} alCerrar={() => {}} alAgregar={alAgregar} />);
    expect(screen.getByRole('group', { name: 'Sabores de la mezcla' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /Elige los sabores/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Elige los sabores: faltan 6')).toBeTruthy();

    // Manjar solo queda 1: con 2 Fresa y 3 Oreo y 1 Manjar suma 6
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Manjar' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));

    expect(alAgregar).toHaveBeenCalledTimes(1);
    const config = alAgregar.mock.calls[0][0];
    expect(config.unidadesPorMezcla).toBe(6);
    expect(config.sabores).toEqual([
      { saborId: 'f', cantidad: 2, nombre: 'Fresa' },
      { saborId: 'o', cantidad: 3, nombre: 'Oreo' },
      { saborId: 'm', cantidad: 1, nombre: 'Manjar' },
    ]);
  });

  it('al pasar a docena el reparto pide completar las 6 unidades que faltan', () => {
    render(<VentanaOpcionesProducto producto={dona} alCerrar={() => {}} alAgregar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: /^Docena/ }));
    expect(screen.getByText('Elegidas 1 de 12')).toBeTruthy();
    expect(screen.getByText('Elige los sabores: faltan 11')).toBeTruthy();
  });
});

async function llegarAResumenLlevar(alCerrar = vi.fn()) {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={alCerrar} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Dona glaseada'));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
  fireEvent.click(screen.getByText('Agregar al pedido'));
  await screen.findByRole('group', { name: 'Comprobante' });
  fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
}

describe('Nuevo pedido de mozo con sabores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(cartaMock as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('la línea viaja con sabores y su cantidad por sabor', async () => {
    await llegarAResumenLlevar();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));

    await vi.waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalled());
    const cuerpo = vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0] as any;
    expect(cuerpo.lineas[0].sabores).toEqual([
      { saborId: 'f', cantidad: 2 },
      { saborId: 'o', cantidad: 4 },
    ]);
  });

  it('SABOR_AGOTADO: el mensaje sale dentro del modal y el modal no se cierra', async () => {
    const alCerrar = vi.fn();
    vi.mocked(pedidosApi.crearPedidoAdmin).mockRejectedValue(
      new ErrorApi('SABOR_AGOTADO', 'Ya no quedan Fresa', 409, {
        codigo: 'SABOR_AGOTADO',
        mensaje: 'Ya no quedan Fresa',
        productoId: 'dona-1',
        saborId: 'f',
        saborNombre: 'Fresa',
      }),
    );
    await llegarAResumenLlevar(alCerrar);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Ya no quedan Fresa (Dona glaseada)');
    expect(alerta).toHaveTextContent('El pedido sigue igual');
    expect(alCerrar).not.toHaveBeenCalled();
  });
});
