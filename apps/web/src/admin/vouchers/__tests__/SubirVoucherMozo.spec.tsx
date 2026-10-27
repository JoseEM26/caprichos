import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

describe('SubirVoucherMozo (Flujo de subida del Mozo en Salón)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('permite seleccionar una foto y al ser legible confirma al mozo sin mostrar semáforo ni datos', async () => {
    const alVoucherValido = vi.fn();
    const alCambiarEstado = vi.fn();

    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(
      async (archivo) => archivo,
    );

    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'vch-101',
      legible: true,
      mensaje: 'Lectura procesada',
    });

    render(
      <SubirVoucherMozo
        pedidoId="mesa-5"
        medio="YAPE"
        alVoucherValido={alVoucherValido}
        alCambiarEstado={alCambiarEstado}
      />,
    );

    expect(screen.getByText(/Foto del voucher \(YAPE\)/i)).toBeDefined();

    const input = screen.getByTestId('input-voucher-archivo');
    const fakeFile = new File(['dummy-img'], 'voucher-yape.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(vouchersApi.subirVoucher).toHaveBeenCalledTimes(1);
    });

    expect(vouchersApi.subirVoucher).toHaveBeenCalledWith(
      fakeFile,
      'mesa-5',
      'YAPE',
    );

    await waitFor(() => {
      expect(
        screen.getByText('Foto del voucher lista para confirmar'),
      ).toBeDefined();
    });

    expect(alVoucherValido).toHaveBeenCalledWith({
      id: 'vch-101',
      legible: true,
    });

    // Regla de oro: mozo NUNCA ve semáforo ni datos extraídos
    expect(screen.queryByText(/CONFIABLE/i)).toBeNull();
    expect(screen.queryByText(/OBSERVADO/i)).toBeNull();
    expect(screen.queryByText(/Titular/i)).toBeNull();
  });

  it('si la foto no se lee, muestra el mensaje exacto del contrato y botón "Tomar otra foto"', async () => {
    const alVoucherValido = vi.fn();

    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(
      async (archivo) => archivo,
    );

    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'vch-999',
      legible: false,
    });

    render(
      <SubirVoucherMozo
        pedidoId="mesa-12"
        medio="PLIN"
        alVoucherValido={alVoucherValido}
      />,
    );

    const input = screen.getByTestId('input-voucher-archivo');
    const fakeFile = new File(['borrosa'], 'voucher-borroso.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(
          'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.',
        ),
      ).toBeDefined();
    });

    const btnOtraFoto = screen.getByTestId('btn-tomar-otra-foto');
    expect(btnOtraFoto).toBeDefined();
    expect(btnOtraFoto.textContent).toContain('Tomar otra foto');

    expect(alVoucherValido).toHaveBeenCalledWith({
      id: 'vch-999',
      legible: false,
    });

    // Mozo NUNCA ve semáforo ni datos
    expect(screen.queryByText(/ILEGIBLE/i)).toBeNull();
  });
});
