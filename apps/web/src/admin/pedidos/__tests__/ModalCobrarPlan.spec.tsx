import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';

// Caja: si el pedido trae plan de pago (pago dividido), las filas de cobro salen precargadas con ese plan.
const base: Pedido = {
  id: '81',
  codigo: 'CP-081',
  canal: 'MOZO',
  modalidad: 'MESA',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  total: '30.00',
  subtotal: '30.00',
  descuento: '0',
  creado_en: '2026-10-29T18:00:00Z',
};

describe('ModalCobrar: precarga del plan de pago', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
  });

  it('con plan: una fila por medio con su monto y el «paga con» en la fila de efectivo', () => {
    const pedido: Pedido = {
      ...base,
      pago_metodo: 'YAPE',
      paga_con: '20',
      planPago: [
        { medio: 'EFECTIVO', monto: '10.00' },
        { medio: 'YAPE', monto: '20.00' },
      ],
    };
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);

    expect(screen.getByDisplayValue('10.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
  });

  it('sin plan se queda con una sola fila por el total, como antes', () => {
    const pedido: Pedido = { ...base, pago_metodo: 'EFECTIVO' };
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);

    expect(screen.getByDisplayValue('30.00')).toBeInTheDocument();
    expect(screen.getAllByDisplayValue(/\d/)).toHaveLength(1);
  });
});
