import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';

describe('ModalPrecuenta - Flujo de cobro del mozo con vouchers digitales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const propsBase = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    lineas: [
      { cantidad: 2, nombre: 'Frappé Moka', detalle: 'Grande · Chantilly' },
    ],
    total: 32.0,
  };

  it('permite elegir Yape o Plin y bloquea confirmar cobro hasta que el voucher sea legible', async () => {
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(
      async (archivo) => archivo,
    );

    render(<ModalPrecuenta {...propsBase} />);

    // Por defecto es Efectivo y el botón está habilitado
    const btnCobro = screen.getByTestId('btn-confirmar-cobro-mozo');
    expect(btnCobro.textContent).toContain('Confirmar cobro (Efectivo)');
    expect(btnCobro.hasAttribute('disabled')).toBe(false);

    // Cambiar a Yape
    const btnYape = screen.getByText('Yape');
    fireEvent.click(btnYape);

    // Al elegir Yape aparece la sección Foto del voucher y se deshabilita el cobro
    expect(screen.getByText(/Foto del voucher \(YAPE\)/i)).toBeDefined();
    expect(btnCobro.hasAttribute('disabled')).toBe(true);
    expect(btnCobro.textContent).toContain('Sube el voucher para cobrar');

    // Subir un voucher que resulta legible
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'vch-1234',
      legible: true,
    });

    const input = screen.getByTestId('input-voucher-archivo');
    const fakeFile = new File(['voucher'], 'voucher.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(screen.getByText('Foto del voucher lista para confirmar')).toBeDefined();
    });

    // Ahora el botón de confirmar cobro se habilita
    expect(btnCobro.hasAttribute('disabled')).toBe(false);
    expect(btnCobro.textContent).toContain('Confirmar cobro (Yape)');
  });

  it('abre diálogo Confirmar Sí/No antes de registrar el cobro', async () => {
    const alCobrar = vi.fn();
    render(<ModalPrecuenta {...propsBase} alCobrar={alCobrar} />);

    const btnCobro = screen.getByTestId('btn-confirmar-cobro-mozo');
    fireEvent.click(btnCobro);

    // Diálogo Confirmar Sí/No
    expect(screen.getByText('¿Confirmar cobro de Mesa 4?')).toBeDefined();

    const btnSi = screen.getByText('Sí, registrar cobro');
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(alCobrar).toHaveBeenCalledWith('Efectivo', undefined);
    });
  });
});
