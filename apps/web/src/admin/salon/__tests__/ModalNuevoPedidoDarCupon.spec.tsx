import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { irAlPago } from './continuarYEnviar';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { api } from '../../../comun/api';

const sesion = vi.hoisted(() => ({ permisos: [] as string[] }));

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: (p: string) => sesion.permisos.includes(p) }) }));
vi.mock('../useSalonSocket', () => ({ useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }) }));
vi.mock('../api', () => ({ salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn(), obtenerMesas: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn(async () => []) }));

import { salonApi } from '../api';

const carta = {
  categorias: [
    {
      id: 'c1',
      nombre: 'Bebidas',
      orden: 1,
      productos: [{ id: 'p1', nombre: 'Café Americano', descripcion: '', fotoUrl: null, precio: 20, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};

const cupon = { id: '7', codigoBase: 'AMIGO15', descripcion: 'Para un amigo', descuentoTipo: 'PORCENTAJE', descuentoValor: 15, diasValidez: 10, quedan: 5, alcance: 'Toda la carta' };

/** En el paso de pago, efectivo exacto (el envío exige «con cuánto paga»). */
function pagoExacto() {
  fireEvent.click(screen.getByRole('button', { name: /Pago exacto/ }));
}

async function hastaElPago() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByLabelText(/Celular del cliente/), { target: { value: '955512345' } });
  await screen.findByText(/Celular sin cuenta/);
  fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Pepe' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  irAlPago();
  pagoExacto();
}

describe('ModalNuevoPedidoMesa: dar un cupón al crear el pedido', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sesion.permisos = ['cupones/dar'];
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: 'x', codigo: 'CP-1' } as any);
    vi.mocked(api.get).mockImplementation(async (ruta: string) => (ruta === '/admin/cupones/para-dar' ? { cupones: [cupon], dado: null } : { items: [] }));
    vi.mocked(api.post).mockResolvedValue({} as any);
  });

  it('con permiso: el bloque aparece en el paso de pago y el cupón elegido viaja con el pedido', async () => {
    await hastaElPago();
    fireEvent.click(await screen.findByRole('button', { name: /Dar un cupón a este cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Para un amigo/ }));
    expect(screen.getByText('Se imprimirá en el voucher de este cliente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar a cocina/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalled());
    expect(vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0]).toMatchObject({ cuponDarId: '7' });
  });

  it('sin permiso cupones/dar: el bloque no aparece y el envío no lleva cupón', async () => {
    sesion.permisos = [];
    await hastaElPago();
    await screen.findByRole('button', { name: /Enviar a cocina/ });
    expect(screen.queryByText(/Dar un cupón a este cliente/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Enviar a cocina/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalled());
    expect(vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0]).not.toHaveProperty('cuponDarId');
  });

  it('si el cupón no se puede dar: el pedido queda creado y la ventana avisa con el motivo', async () => {
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({
      id: 'x',
      codigo: 'CP-9',
      cuponNoDado: { motivo: 'Ya se dieron todos los cupones de este tipo' },
    } as any);
    const alCerrar = vi.fn();
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={alCerrar} pisos={[]} pasoInicial="modal" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    fireEvent.change(screen.getByLabelText(/Celular del cliente/), { target: { value: '955512345' } });
    await screen.findByText(/Celular sin cuenta/);
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Pepe' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Café Americano'));
    fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByText('Agregar al pedido'));
    irAlPago();
    pagoExacto();
    fireEvent.click(await screen.findByRole('button', { name: /Dar un cupón a este cliente/ }));
    fireEvent.click(screen.getByRole('button', { name: /Para un amigo/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar a cocina/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));

    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toContain('El pedido se creó, pero el cupón no se pudo dar: Ya se dieron todos los cupones de este tipo');
    // no se cierra sola: el usuario lee el aviso; y no se puede volver a enviar el mismo pedido
    expect(alCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Enviar a cocina/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(alCerrar).toHaveBeenCalled();
  });
});
