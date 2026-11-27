import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../useSalonSocket', () => ({ useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }) }));
vi.mock('../api', () => ({ salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));

const carta = {
  categorias: [
    {
      id: 'cat-1', nombre: 'Postres', orden: 1,
      productos: [{ id: 'prod-1', nombre: 'Torta', descripcion: '', fotoUrl: null, precio: 66.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};

/** 26/11: pedido para llevar todo de cortesía: el botón no se habilitaba y el efectivo quedaba en el total anterior. */
describe('Nuevo pedido para llevar: todo cortesía (total S/ 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => p === 'cortesias/dar', usuario: { rol: 'CAJERO' } } as any);
    vi.spyOn(api, 'get').mockResolvedValue({ medios: ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] } as any);
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: 'ped-1', codigo: 'CP-W001', estado: 'COLA', total: 0 } as any);
  });

  it('va al pago (efectivo S/ 66.50), vuelve, da la cortesía: no hay nada que cobrar y se envía sin plan ni «con cuánto paga»', async () => {
    render(<ModalNuevoPedidoMesa abierto alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Kevin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
    fireEvent.click(await screen.findByText('Torta'));
    const agregar = screen.queryByText('Agregar al pedido');
    if (agregar) fireEvent.click(agregar);

    // Primero al pago: el efectivo sigue al total
    irAlPago();
    expect(screen.getByTestId('plan-pago-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Atrás/ }));

    // Vuelve y la da como cortesía
    fireEvent.click(screen.getAllByRole('button', { name: 'Dar como cortesía' })[0]);
    fireEvent.click(screen.getByLabelText('Error de cocina'));
    fireEvent.click(screen.getByRole('button', { name: 'Dar cortesía' }));
    irAlPago();

    expect(screen.getByTestId('nada-que-cobrar')).toHaveTextContent('Todo es cortesía');
    expect(screen.queryByTestId('plan-pago-editor')).toBeNull();
    const b = screen.queryByTestId('comprobante-BOLETA');
    if (b) fireEvent.click(b);
    const enviar = screen.getByRole('button', { name: /^Enviar a cocina/ });
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, registrar' }));

    await waitFor(() => expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledTimes(1));
    const dto: any = vi.mocked(pedidosApi.crearPedidoAdmin).mock.calls[0][0];
    expect(dto.lineas[0].cortesia).toEqual({ motivo: 'ERROR_COCINA', nota: undefined });
    expect(dto.pago.plan ?? []).toEqual([]);
    expect(dto.pago.pagaCon).toBeUndefined();
  });
});
