import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

describe('SubirVoucherMozo: cambiar foto y quitar voucher tras subir', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'vch-7', legible: true } as any);
  });

  const subirFoto = async () => {
    const input = screen.getByTestId('input-voucher-archivo') as HTMLInputElement;
    const foto = new File(['x'], 'voucher.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [foto] } });
    await waitFor(() => expect(screen.getByTestId('btn-cambiar-foto')).toBeDefined());
  };

  it('tras subir muestra Cambiar foto y Quitar voucher con 44 px de alto', async () => {
    render(<SubirVoucherMozo pedidoId="25" medio="PLIN" alVoucherValido={() => undefined} quitable opcional />);
    await subirFoto();
    expect((screen.getByTestId('btn-cambiar-foto') as HTMLElement).style.minHeight).toBe('44px');
    expect((screen.getByTestId('btn-quitar-voucher') as HTMLElement).style.minHeight).toBe('44px');
  });

  it('Quitar pide confirmación Sí/No; Sí llama a quitarVoucher con el id y avisa; No no quita', async () => {
    const quitar = vi.spyOn(vouchersApi, 'quitarVoucher').mockResolvedValue({ ok: true } as any);
    const alQuitado = vi.fn();
    render(<SubirVoucherMozo pedidoId="25" medio="PLIN" alVoucherValido={() => undefined} quitable opcional alQuitado={alQuitado} />);
    await subirFoto();

    fireEvent.click(screen.getByTestId('btn-quitar-voucher'));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(quitar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('btn-quitar-voucher'));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(alQuitado).toHaveBeenCalled());
    expect(quitar).toHaveBeenCalledWith('vch-7');
    expect(screen.queryByTestId('btn-cambiar-foto')).toBeNull();
  });

  it('sin quitable no ofrece Quitar voucher, solo Cambiar foto', async () => {
    render(<SubirVoucherMozo pedidoId="25" medio="PLIN" alVoucherValido={() => undefined} opcional />);
    await subirFoto();
    expect(screen.queryByTestId('btn-quitar-voucher')).toBeNull();
    expect(screen.getByTestId('btn-cambiar-foto')).toBeDefined();
  });
});
