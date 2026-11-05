import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstadoVoucherPedido } from '../EstadoVoucherPedido';

// Seguimiento: el estado del voucher se muestra con texto (no solo color) y solo con pago digital.
describe('EstadoVoucherPedido (seguimiento)', () => {
  it('sin voucher: pide enviarlo por WhatsApp', () => {
    render(<EstadoVoucherPedido voucher={{ estado: 'SIN_VOUCHER', medio: 'YAPE', actualizadoEn: null }} />);
    expect(screen.getByRole('status')).toBeDefined();
    expect(
      screen.getByText('Aún no recibimos tu voucher. Envíalo por WhatsApp para que revisemos tu pago'),
    ).toBeDefined();
  });

  it('en revisión: avisa que se está revisando', () => {
    render(<EstadoVoucherPedido voucher={{ estado: 'EN_REVISION', medio: 'PLIN', actualizadoEn: null }} />);
    expect(screen.getByText('Recibimos tu voucher y lo estamos revisando')).toBeDefined();
  });

  it('verificado: muestra Pago verificado con el medio', () => {
    render(
      <EstadoVoucherPedido voucher={{ estado: 'VERIFICADO', medio: 'PLIN', actualizadoEn: '2026-10-23T17:20:00Z' }} />,
    );
    expect(screen.getByText(/^Pago verificado ✓ \(Plin, /)).toBeDefined();
  });

  it('verificado sin hora ni medio: solo Pago verificado', () => {
    render(<EstadoVoucherPedido voucher={{ estado: 'VERIFICADO', medio: null, actualizadoEn: null }} />);
    expect(screen.getByText('Pago verificado ✓')).toBeDefined();
  });

  it('rechazado: pide otra foto y muestra el motivo corto', () => {
    render(
      <EstadoVoucherPedido
        voucher={{ estado: 'RECHAZADO', medio: 'YAPE', actualizadoEn: null, motivo: 'Voucher no legible' }}
      />,
    );
    expect(
      screen.getByText(
        'No pudimos leer tu voucher: Voucher no legible. Envíanos otra foto por WhatsApp',
      ),
    ).toBeDefined();
  });

  it('pago en efectivo (sin bloque de voucher): no muestra la tarjeta', () => {
    const { container } = render(<EstadoVoucherPedido voucher={undefined} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
