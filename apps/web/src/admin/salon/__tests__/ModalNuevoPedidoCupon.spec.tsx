import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { continuarYEnviar, irAlPago } from './continuarYEnviar';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';
import { salonApi } from '../api';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { api, ErrorApi } from '../../../comun/api';
import { llenarPagaCon } from './ayudaPagaCon';

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

async function conUnProducto() {
  render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
  fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
  fireEvent.change(screen.getByPlaceholderText('Ej.: María López'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar a productos →' }));
  fireEvent.click(await screen.findByText('Café Americano'));
  fireEvent.change(await screen.findByPlaceholderText('Ej.: Lucía o Mesa 4'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByText('Agregar al pedido'));
  fireEvent.click(await screen.findByRole('button', { name: 'Cupón' }));
}
const aplicar = (codigo: string) => {
  fireEvent.change(screen.getByPlaceholderText('Código de cupón (opcional)'), { target: { value: codigo } });
  fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
};

describe('ModalNuevoPedidoMesa: cupón con el validador real', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerCarta).mockResolvedValue(carta as any);
    vi.mocked(salonApi.obtenerPlano).mockResolvedValue([] as any);
  });

  it('aplica el cupón: llama a /admin/cupones/validar con canal y líneas, y muestra el descuento', async () => {
    vi.mocked(api.post).mockResolvedValue({ valido: true, descuento: 2, envioGratis: false, mensaje: 'ok' });
    await conUnProducto();
    aplicar('verano10');
    expect(await screen.findByText('Cupón VERANO10 aplicado: - S/ 2.00')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/admin/cupones/validar', {
      codigo: 'VERANO10',
      canal: 'CAJA',
      lineas: [{ productoId: 'prod-1', cantidad: 1, subtotal: 20, precioUnitario: 20 }],
    });
    expect(screen.getByText('- S/ 2.00')).toBeInTheDocument();
  });

  it('un cupón inválido muestra el mensaje del servidor y no descuenta; ya no existe el código de prueba', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('CUPON_INVALIDO', 'El código de cupón no existe', 404));
    await conUnProducto();
    aplicar('DESCUENTO10');
    expect(await screen.findByText('El código de cupón no existe')).toBeInTheDocument();
    expect(screen.queryByText(/aplicado/)).toBeNull();
  });

  it('el mínimo de compra se explica en español', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('COMPRA_MINIMA_NO_ALCANZADA', 'Este cupón exige una compra mínima de S/ 80.00', 400));
    await conUnProducto();
    aplicar('GRANDE');
    expect(await screen.findByText(/compra mínima de S\/ 80\.00/)).toBeInTheDocument();
  });

  it('sin permiso lo dice claro', async () => {
    vi.mocked(api.post).mockRejectedValue(new ErrorApi('PERMISO_DENEGADO', 'x', 403));
    await conUnProducto();
    aplicar('X1');
    expect(await screen.findByText('No tienes permiso para aplicar cupones.')).toBeInTheDocument();
  });

  it('al registrar, el código del cupón viaja en el pedido', async () => {
    vi.mocked(api.post).mockResolvedValue({ valido: true, descuento: 2, envioGratis: false, mensaje: 'ok' });
    vi.mocked(pedidosApi.crearPedidoAdmin).mockResolvedValue({ id: '1' } as any);
    await conUnProducto();
    aplicar('VERANO10');
    await screen.findByText('Cupón VERANO10 aplicado: - S/ 2.00');
    irAlPago();
    const boleta = screen.queryByTestId('comprobante-BOLETA');
    if (boleta) fireEvent.click(boleta);
    llenarPagaCon();
    continuarYEnviar();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar' }));
    await waitFor(() =>
      expect(pedidosApi.crearPedidoAdmin).toHaveBeenCalledWith(expect.objectContaining({ cuponCodigo: 'VERANO10' }), expect.any(String)),
    );
  });
});
