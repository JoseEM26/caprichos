import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../SeccionUbicacionPedido', () => ({ SeccionUbicacionPedido: () => null }));
vi.mock('../SeccionComprobantesPedido', () => ({ SeccionComprobantesPedido: () => null }));
vi.mock('../../mensajes/BotonAbrirChatCliente', () => ({ BotonAbrirChatCliente: () => null }));

import { CapaEntrega } from '../CapaEntrega';
import { ModalCobrar } from '../ModalCobrar';

const base: any = { id: 1, codigo: 'CP-W001', estado: 'LISTO', canal: 'CAJA', modalidad: 'RECOGER', pago_estado: 'PENDIENTE', total: '20.00', subtotal: '20.00', descuento: '0', creado_en: '2026-10-27T18:00:00Z', cliente_nombre: 'Cliente de prueba', historial: [], eventos: [] };
const props = { esDelivery: false, esMesa: false, puedeCorregirCliente: true, alCorregirCliente: vi.fn(), alUbicar: vi.fn(), alActualizar: vi.fn() };

describe('pedido sin celular: aviso visible', () => {
  it('detalle: avisa que la boleta no llegará y ofrece agregar el celular', () => {
    const alCorregirCliente = vi.fn();
    render(<CapaEntrega pedido={{ ...base, cliente_telefono: null }} {...props} alCorregirCliente={alCorregirCliente} />);
    expect(screen.getByTestId('aviso-sin-celular')).toHaveTextContent('Este pedido no tiene celular: la boleta no llegará por WhatsApp');
    fireEvent.click(screen.getByRole('button', { name: 'Agregar celular' }));
    expect(alCorregirCliente).toHaveBeenCalled();
  });
  it('detalle: con celular real no hay aviso', () => {
    render(<CapaEntrega pedido={{ ...base, cliente_telefono: '987654321' }} {...props} />);
    expect(screen.queryByTestId('aviso-sin-celular')).toBeNull();
  });
  it('cobro de Caja: avisa si no hay celular y calla si lo hay', () => {
    const { unmount } = render(<ModalCobrar pedido={{ ...base, cliente_telefono: null }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    expect(screen.getByTestId('aviso-sin-celular')).toHaveTextContent('Este pedido no tiene celular: la boleta no llegará por WhatsApp');
    unmount();
    render(<ModalCobrar pedido={{ ...base, cliente_telefono: '987654321' }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    expect(screen.queryByTestId('aviso-sin-celular')).toBeNull();
  });
});
