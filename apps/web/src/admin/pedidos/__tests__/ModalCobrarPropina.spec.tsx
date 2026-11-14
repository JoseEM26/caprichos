import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { api } from '../../../comun/api';

// Caja: un pedido sin propina (pago al final, delivery, WhatsApp) permite escribirla al cobrar, con cualquier medio.
const base: Pedido = {
  id: '90', codigo: 'CP-090', canal: 'MOZO', modalidad: 'MESA', estado: 'COLA', pago_estado: 'PENDIENTE',
  total: '40.00', subtotal: '40.00', descuento: '0', creado_en: '2026-11-13T18:00:00Z', pago_metodo: 'EFECTIVO',
};

const local = (caja: boolean) => vi.spyOn(api, 'get').mockResolvedValue({ propina: { caja, tope: 50 } } as any);

describe('ModalCobrar: propina de monto libre al cobrar', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
  });

  it('con Caja encendida: la propina suma al total, al primer renglón y viaja en el cobro', async () => {
    local(true);
    const cobrar = vi.fn().mockResolvedValue({});
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);
    fireEvent.change(await screen.findByLabelText(/Propina para el equipo/), { target: { value: '5,50' } });
    expect(screen.getByDisplayValue('45.50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Registrar cobro/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }));
    await waitFor(() => expect(cobrar).toHaveBeenCalled());
    const dto = cobrar.mock.calls[0][0];
    expect(dto.propina).toBe(5.5);
    expect(dto.pagos[0].monto).toBe(45.5);
  });

  it('con Caja apagada no hay campo de propina', async () => {
    const espia = local(false);
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    await waitFor(() => expect(espia).toHaveBeenCalled());
    expect(screen.queryByTestId('cobro-propina-escribir')).toBeNull();
  });

  it('pedido que ya trae propina: no se escribe otra', async () => {
    local(true);
    render(<ModalCobrar pedido={{ ...base, propina: '5.00' }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    expect(screen.queryByTestId('cobro-propina-escribir')).toBeNull();
    expect(screen.getByTestId('cobro-propina')).toBeInTheDocument();
  });

  it('sobre el tope: error y no suma', async () => {
    local(true);
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText(/Propina para el equipo/), { target: { value: '80' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/50\.00/);
    expect(screen.getByDisplayValue('40.00')).toBeInTheDocument();
  });
});
