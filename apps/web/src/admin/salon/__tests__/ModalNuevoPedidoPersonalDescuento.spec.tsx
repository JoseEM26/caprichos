import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { api } from '../../../comun/api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { listarPersonalActivo } from '../../creditos/creditosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../useSalonSocket', () => ({
  useSalonSocket: () => ({ avisoListo: null, cerrarAvisoListo: () => {} }),
}));
vi.mock('../api', () => ({
  salonApi: { obtenerCarta: vi.fn(), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() },
}));
vi.mock('../../../comun/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn() }));

const carta = {
  categorias: [
    {
      id: 'cat-1', nombre: 'Bebidas', orden: 1,
      productos: [{ id: 'prod-1', nombre: 'Café Americano', descripcion: 'Café', fotoUrl: null, precio: 20, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null }],
    },
  ],
};

async function elegirTrabajador(nombre: RegExp) {
  fireEvent.click(await screen.findByRole('button', { name: nombre }));
}

/** Para llevar, pedido del personal (María Soto) con un café de S/ 20 */
async function llegar() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Personal' }));
  await elegirTrabajador(/María Soto/);
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'María' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
}

// El servidor responde según el trabajador pedido
const respuestaPorTrabajador = (body: any) => {
  const pct = body.colaboradorPartyId === '3' ? 40 : 25;
  return Promise.resolve({ descuentoTotal: 0, descuentoPersonal: { pct, monto: (20 * pct) / 100 } });
};

describe('Pedido del personal en Nuevo pedido: descuento del personal visible', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: () => true, usuario: { rol: 'CAJERO' } } as any);
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
    vi.mocked(listarPersonalActivo).mockResolvedValue([
      { partyId: '2', nombre: 'María Soto', rol: 'MOZO', descuentoPct: 25 },
      { partyId: '3', nombre: 'Luis Peña', rol: 'MOZO', descuentoPct: 40 },
    ]);
    vi.mocked(api.get).mockResolvedValue({ items: [] } as any);
    vi.mocked(api.post).mockImplementation(((url: string, body: any) =>
      String(url).includes('vista-previa') ? respuestaPorTrabajador(body) : Promise.resolve({})) as any);
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: '9', codigo: 'CP-W009' } as any);
  });

  it('pide la vista previa con el trabajador y muestra la línea y el total con descuento (a crédito)', async () => {
    await llegar();
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/admin/ofertas/vista-previa',
        expect.objectContaining({ colaboradorPartyId: '2', lineas: [{ productoId: 'prod-1', cantidad: 1, subtotal: 20, precioUnitario: 20 }] }),
      ),
    );
    expect(await screen.findByText('Descuento del personal 25%')).toBeInTheDocument();
    expect(screen.getByText('- S/ 5.00')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 15.00').length).toBeGreaterThan(0);
  });

  it('pagar ahora: el «paga con» y el pago exacto usan el total con descuento', async () => {
    await llegar();
    await screen.findByText('Descuento del personal 25%');
    irAlPago();
    fireEvent.click(await screen.findByRole('button', { name: /Pagar ahora/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Pago exacto' }));
    expect((document.querySelector('#personal-paga-con') as HTMLInputElement).value).toBe('15.00');
    fireEvent.change(document.querySelector('#personal-paga-con') as HTMLInputElement, { target: { value: '16' } });
    expect(screen.getByTestId('personal-vuelto')).toHaveTextContent('Vuelto: S/ 1.00');
    expect(screen.getByRole('button', { name: /^Enviar a cocina/ })).toHaveTextContent('S/ 15.00');
  });

  it('al cambiar de trabajador recalcula con su porcentaje', async () => {
    await llegar();
    await screen.findByText('Descuento del personal 25%');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    await elegirTrabajador(/Luis Peña/);
    expect(await screen.findByText('Descuento del personal 40%')).toBeInTheDocument();
    expect(screen.getByText('- S/ 8.00')).toBeInTheDocument();
    expect(screen.getAllByText('S/ 12.00').length).toBeGreaterThan(0);
  });

  it('si el servidor falla no inventa el descuento y avisa que se confirma al guardar', async () => {
    vi.mocked(api.post).mockRejectedValue(new Error('caído'));
    await llegar();
    expect(await screen.findByText('El descuento del personal se confirma al guardar.')).toBeInTheDocument();
    expect(screen.queryByText(/Descuento del personal \d+%/)).toBeNull();
    expect(screen.getAllByText('S/ 20.00').length).toBeGreaterThan(0);
  });
});
