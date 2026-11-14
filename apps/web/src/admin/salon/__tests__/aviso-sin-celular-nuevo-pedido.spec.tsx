import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalNuevoPedidoMesa } from '../componentes/ModalNuevoPedidoMesa';

vi.mock('../api', () => ({ salonApi: { obtenerCarta: vi.fn().mockResolvedValue({ categorias: [] }), obtenerPlano: vi.fn(), abrirPedidoMesa: vi.fn() } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { crearPedidoAdmin: vi.fn() } }));
vi.mock('../../vouchers/vouchersApi', () => ({ vouchersApi: { subirVoucher: vi.fn() } }));

const AVISO = 'Sin celular no recibirá su boleta por WhatsApp ni sumará puntos';

describe('Caja «Nuevo pedido»: aviso junto al celular vacío', () => {
  it('para llevar: avisa sin celular y deja de avisar al escribirlo; en delivery no (es obligatorio)', async () => {
    render(<ModalNuevoPedidoMesa abierto={true} alCerrar={vi.fn()} pisos={[]} pasoInicial="modal" />);
    fireEvent.click(screen.getByRole('button', { name: /Para llevar/ }));
    expect(screen.getByTestId('aviso-sin-celular')).toHaveTextContent(AVISO);
    fireEvent.change(screen.getByPlaceholderText('9 dígitos'), { target: { value: '987654321' } });
    expect(screen.queryByTestId('aviso-sin-celular')).toBeNull();
  });
});
