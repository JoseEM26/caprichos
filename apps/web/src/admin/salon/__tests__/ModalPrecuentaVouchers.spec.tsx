import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';

describe('ModalPrecuenta - el mozo envía el cobro a Caja (no lo cobra)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const propsBase = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    lineas: [{ cantidad: 2, nombre: 'Frappé Moka', detalle: 'Grande · Chantilly' }],
    total: 32.0,
  };

  const elegirYPedirConfirmacion = () => {
    fireEvent.click(screen.getByTestId('btn-enviar-caja'));
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));
  };

  it('no ofrece cobrar ni cobrar sin comprobante: solo enviar a Caja', () => {
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    expect(screen.queryByTestId('btn-confirmar-cobro-mozo')).toBeNull();
    expect(screen.queryByTestId('btn-mozo-sin-comprobante')).toBeNull();
    expect(screen.getByTestId('btn-enviar-caja')).toBeDefined();
  });

  it('efectivo: no pide foto y avisa a Caja con el medio EFECTIVO, sin marcar nada como pagado', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    expect(screen.queryByTestId('seccion-subir-voucher-mozo')).toBeNull();
    expect(screen.getByTestId('aviso-efectivo-caja')).toBeDefined();

    fireEvent.click(screen.getByTestId('btn-enviar-caja'));
    expect(screen.getByText('¿Enviar a Caja el cobro de Mesa 4?')).toBeDefined();
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));

    await waitFor(() => {
      expect(enviar).toHaveBeenCalledWith('P-20', 'EFECTIVO');
    });
    expect(screen.getByTestId('aviso-enviado-caja').textContent).toContain('Enviado a Caja, ellos lo revisan.');
    expect(screen.queryByTestId('btn-enviar-caja')).toBeNull();
  });

  it('Yape con foto legible: la sube, habilita el envío y envía con YAPE', async () => {
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'vch-1', legible: true });
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    fireEvent.click(screen.getByText('Yape'));
    expect(screen.getByText(/Foto del voucher \(YAPE\)/i)).toBeDefined();

    const input = screen.getByTestId('input-voucher-archivo');
    fireEvent.change(input, {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Foto del voucher lista para confirmar')).toBeDefined();
    });

    elegirYPedirConfirmacion();

    await waitFor(() => {
      expect(enviar).toHaveBeenCalledWith('P-20', 'YAPE');
    });
    expect(screen.getByTestId('aviso-enviado-caja')).toBeDefined();
  });

  it('Yape con foto ilegible: el mozo ve que no se lee y puede tomar otra foto, sin datos ni semáforo', async () => {
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: 'vch-2',
      legible: false,
      mensaje: 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.',
    });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    fireEvent.click(screen.getByText('Yape'));
    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('voucher-mozo-ilegible')).toBeDefined();
    });
    expect(screen.getByText('Este voucher no se lee bien. Vuelve a tomar la foto, por favor.')).toBeDefined();
    expect(screen.getByTestId('btn-tomar-otra-foto')).toBeDefined();
    expect(screen.queryByText(/CONFIABLE|OBSERVADO|RARO|semáforo/i)).toBeNull();
  });

  it('confirmación No no envía nada a Caja', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    fireEvent.click(screen.getByTestId('btn-enviar-caja'));
    fireEvent.click(screen.getByText('No, cancelar'));

    expect(enviar).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn-enviar-caja')).toBeDefined();
  });

  it('si la API falla, muestra el error y deja reintentar', async () => {
    vi.spyOn(vouchersApi, 'enviarACaja').mockRejectedValue(new Error('Sin conexión con el servidor'));
    render(<ModalPrecuenta {...propsBase} pedidoId="P-20" />);

    elegirYPedirConfirmacion();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Sin conexión con el servidor');
    });
    expect(screen.getByTestId('btn-enviar-caja')).toBeDefined();
  });

  it('sin pedido (sin pedidoId) no muestra el envío a Caja', () => {
    render(<ModalPrecuenta {...propsBase} />);
    expect(screen.queryByTestId('seccion-envio-caja-mozo')).toBeNull();
    expect(screen.queryByTestId('btn-enviar-caja')).toBeNull();
  });
});
