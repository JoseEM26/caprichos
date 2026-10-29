import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

describe('SubirVoucherMozo: lectura automática no disponible (revisionManual)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  const subirFoto = () =>
    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });

  it('con revisionManual muestra «Voucher guardado» y no dice que es legible ni lista para confirmar', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v9', legible: true, revisionManual: true } as any);
    const alVoucherValido = vi.fn();
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={alVoucherValido} />);

    subirFoto();

    expect(await screen.findByText(/Voucher guardado\. La lectura automática no está disponible; Caja lo revisará\./)).toBeInTheDocument();
    expect(screen.queryByText('Voucher legible')).toBeNull();
    expect(screen.queryByText('Foto del voucher lista para confirmar')).toBeNull();
    // Sigue contando como subido, igual que antes
    expect(alVoucherValido).toHaveBeenCalledWith({ id: 'v9', legible: true });
  });

  it('sin revisionManual conserva el texto de voucher legible', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v8', legible: true } as any);
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={vi.fn()} />);

    subirFoto();

    expect(await screen.findByText('Foto del voucher lista para confirmar')).toBeInTheDocument();
    expect(screen.queryByText(/lectura automática/)).toBeNull();
  });
});
