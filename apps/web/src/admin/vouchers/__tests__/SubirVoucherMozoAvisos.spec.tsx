import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

describe('SubirVoucherMozo: avisos de lo que no cuadra', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  const subirFoto = () =>
    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });

  it('con avisos: «Voucher recibido, pero revisa esto:», la lista y «Subir otra foto»; no dice «Voucher legible»', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'v1',
      legible: true,
      avisos: ['El monto del voucher (S/ 20.00) no coincide con lo que debe pagar por Yape (S/ 35.50)', 'La fecha del voucher no es de hoy'],
    } as any);
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={vi.fn()} />);

    subirFoto();

    expect(await screen.findByText('Voucher recibido, pero revisa esto:')).toBeInTheDocument();
    const avisos = screen.getByTestId('voucher-mozo-avisos');
    expect(avisos).toHaveTextContent('no coincide con lo que debe pagar por Yape');
    expect(avisos).toHaveTextContent('La fecha del voucher no es de hoy');
    expect(screen.getByRole('button', { name: 'Subir otra foto' })).toBeInTheDocument();
    expect(screen.queryByText('Voucher legible')).toBeNull();
    expect(screen.queryByTestId('voucher-mozo-valido')).toBeNull();
  });

  it('con avisos sigue contando como subido (Caja decide)', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'v2',
      legible: true,
      avisos: ['El medio del voucher (Plin) no coincide con el elegido (Yape)'],
    } as any);
    const alVoucherValido = vi.fn();
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={alVoucherValido} />);

    subirFoto();

    await screen.findByTestId('voucher-mozo-avisos');
    expect(alVoucherValido).toHaveBeenCalledWith({ id: 'v2', legible: true });
  });

  it('sin avisos conserva «Voucher legible» y no muestra la lista', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v3', legible: true, avisos: [] } as any);
    render(<SubirVoucherMozo pedidoId="1" medio="YAPE" alVoucherValido={vi.fn()} />);

    subirFoto();

    expect(await screen.findByText('Foto del voucher lista para confirmar')).toBeInTheDocument();
    expect(screen.queryByTestId('voucher-mozo-avisos')).toBeNull();
    expect(screen.getByTestId('voucher-mozo-valido')).toBeInTheDocument();
  });
});
