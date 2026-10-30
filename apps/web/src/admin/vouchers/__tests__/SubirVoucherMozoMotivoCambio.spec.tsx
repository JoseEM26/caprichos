import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';
import { ErrorApi } from '../../../comun/api';

describe('SubirVoucherMozo: motivo al cambiar un voucher que ya estaba', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  it('si el servidor pide motivo, muestra el campo y reintenta con el motivo escrito', async () => {
    const subir = vi
      .spyOn(vouchersApi, 'subirVoucher')
      .mockRejectedValueOnce(new ErrorApi('MOTIVO_CAMBIO_REQUERIDO', 'Escribe el motivo del cambio (mínimo 5 caracteres)', 400))
      .mockResolvedValueOnce({ id: 'v2', legible: true, avisos: [] } as any);
    const alVoucherValido = vi.fn();
    render(<SubirVoucherMozo pedidoId="7" medio="YAPE" alVoucherValido={alVoucherValido} />);

    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });

    const campo = await screen.findByLabelText('Este pedido ya tenía un voucher. ¿Por qué lo cambias?');
    const boton = screen.getByRole('button', { name: 'Guardar cambio de voucher' });
    expect(boton).toBeDisabled();

    fireEvent.change(campo, { target: { value: 'Captura correcta del cliente' } });
    fireEvent.click(boton);

    await screen.findByTestId('voucher-mozo-valido');
    expect(subir).toHaveBeenLastCalledWith(expect.anything(), '7', 'YAPE', 'Captura correcta del cliente');
    expect(alVoucherValido).toHaveBeenCalledWith({ id: 'v2', legible: true });
    expect(screen.queryByTestId('motivo-cambio-voucher')).toBeNull();
  });
});
