import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { InsigniaNumeroDia } from '../InsigniaNumeroDia';
import { InsigniaDireccionEditada } from '../InsigniaDireccionEditada';

describe('InsigniaNumeroDia (número del día en cocina, referencial)', () => {
  it('muestra «#7 del día» y «—» si el pedido no tiene número', () => {
    const { rerender } = render(<InsigniaNumeroDia numero={7} />);
    expect(screen.getByText('#7 del día')).toBeInTheDocument();
    rerender(<InsigniaNumeroDia numero={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/del día/)).toBeNull();
  });
});

describe('InsigniaDireccionEditada', () => {
  it('se ve con su texto', () => {
    render(<InsigniaDireccionEditada />);
    expect(screen.getByText('Dirección editada')).toBeInTheDocument();
  });
});

describe('ModalCobrar: ajuste por cambio de dirección sin resolver', () => {
  const base: Pedido = {
    id: '91',
    codigo: 'CP-091',
    canal: 'CARTA',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    pago_estado: 'PENDIENTE',
    total: '30.00',
    subtotal: '30.00',
    descuento: '0',
    creado_en: '2026-11-06T18:00:00Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
  });

  it('con saldo pendiente muestra «Ajuste por cambio de dirección: +S/ x»', async () => {
    render(<ModalCobrar pedido={{ ...base, ajusteUbicacionPendiente: { tipo: 'SALDO', monto: 6 } }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('cobro-ajuste-ubicacion')).toHaveTextContent('Ajuste por cambio de dirección: +S/ 6.00'));
  });

  it('con devolución pendiente muestra «Devolución pendiente S/ x»; sin ajuste no aparece', async () => {
    const { unmount } = render(
      <ModalCobrar pedido={{ ...base, ajusteUbicacionPendiente: { tipo: 'DEVOLUCION', monto: 2.5 } }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByTestId('cobro-ajuste-ubicacion')).toHaveTextContent('Devolución pendiente S/ 2.50'));
    unmount();

    render(<ModalCobrar pedido={{ ...base, ajusteUbicacionPendiente: null }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={vi.fn()} />);
    expect(screen.queryByTestId('cobro-ajuste-ubicacion')).toBeNull();
  });
});
