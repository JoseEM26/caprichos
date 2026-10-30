import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

describe('SubirVoucherMozo: foto o captura, opcional al crear el pedido', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v1', legible: true } as any);
  });

  it('ofrece «Tomar foto» (cámara) y «Subir captura» (galería), con 44 px de alto', () => {
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={vi.fn()} opcional />);

    const camara = screen.getByRole('button', { name: 'Tomar foto' });
    const captura = screen.getByRole('button', { name: 'Subir captura' });
    expect(camara).toHaveStyle({ minHeight: '44px' });
    expect(captura).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByText(/Opcional ahora: puedes subirlo después/)).toBeInTheDocument();

    // Solo la cámara pide captura en vivo; la galería no
    expect(screen.getByTestId('input-voucher-archivo')).toHaveAttribute('capture', 'environment');
    expect(screen.getByTestId('input-voucher-galeria')).not.toHaveAttribute('capture');
  });

  it('subir desde la galería usa el mismo flujo de subida', async () => {
    const alVoucherValido = vi.fn();
    render(<SubirVoucherMozo pedidoId="1" medio="PLIN" alVoucherValido={alVoucherValido} opcional />);

    fireEvent.change(screen.getByTestId('input-voucher-galeria'), {
      target: { files: [new File(['img'], 'captura.png', { type: 'image/png' })] },
    });

    await vi.waitFor(() => expect(alVoucherValido).toHaveBeenCalledWith({ id: 'v1', legible: true }));
    expect(vouchersApi.subirVoucher).toHaveBeenCalledWith(expect.anything(), '1', 'PLIN');
  });
});
