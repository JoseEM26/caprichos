import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { vouchersApi } from '../../vouchers/vouchersApi';

const base = {
  abierto: true,
  alCerrar: vi.fn(),
  mesa: 'Mesa 4',
  lineas: [{ cantidad: 1, nombre: 'Café', detalle: '' }],
  total: 40,
  pedidoId: 'P-1',
};

describe('ModalPrecuenta con voucher ya subido', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({ items: [] } as any);
  });

  it('sin plan y pago YAPE con voucher subido: muestra Yape, ya subido y sin selector de foto', () => {
    render(
      <ModalPrecuenta
        {...base}
        pagoMetodo="YAPE"
        vouchersPorMedio={[{ medio: 'YAPE', monto: 40, subido: true, voucherId: '9' }]}
      />,
    );
    expect(screen.getByTestId('voucher-ya-subido-YAPE').textContent).toContain('Voucher de Yape ya subido');
    expect(screen.queryByTestId('seccion-subir-voucher-mozo')).toBeNull();
    expect(screen.queryByTestId('aviso-efectivo-caja')).toBeNull();
    expect(screen.getByText('Caja revisará los vouchers ya subidos.')).toBeDefined();
    expect(screen.queryByTestId('btn-cambiar-voucher-YAPE')).toBeNull();
  });

  it('plan Efectivo + Plin con solo Plin subido: no pide el selector y ofrece Cambiar voucher', () => {
    render(
      <ModalPrecuenta
        {...base}
        plan={[
          { medio: 'EFECTIVO', monto: 10 },
          { medio: 'PLIN', monto: 30 },
        ]}
        vouchersPorMedio={[{ medio: 'PLIN', monto: 30, subido: true }]}
        puedeCambiarVoucher
      />,
    );
    expect(screen.getByTestId('voucher-ya-subido-PLIN')).toBeDefined();
    expect(screen.queryByTestId('seccion-subir-voucher-mozo')).toBeNull();
    fireEvent.click(screen.getByTestId('btn-cambiar-voucher-PLIN'));
    expect(screen.queryByTestId('voucher-ya-subido-PLIN')).toBeNull();
    expect(screen.getByTestId('seccion-subir-voucher-mozo')).toBeDefined();
  });

  it('voucher faltante: muestra el selector de foto', () => {
    render(
      <ModalPrecuenta
        {...base}
        pagoMetodo="YAPE"
        vouchersPorMedio={[{ medio: 'YAPE', monto: 40, subido: false }]}
      />,
    );
    expect(screen.queryByTestId('voucher-ya-subido-YAPE')).toBeNull();
    expect(screen.getByTestId('seccion-subir-voucher-mozo')).toBeDefined();
  });

  it('sin datos del llamador: lee el historial y reconoce un voucher sin medio', async () => {
    (vouchersApi.historialPedido as any).mockResolvedValue({ items: [{ id: '1', estado: 'VIGENTE', legible: true, medio: null }] });
    render(<ModalPrecuenta {...base} pagoMetodo="PLIN" />);
    expect((await screen.findByTestId('voucher-ya-subido-PLIN')).textContent).toContain('Plin');
  });
});
