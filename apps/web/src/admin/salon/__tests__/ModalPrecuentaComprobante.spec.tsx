import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { vouchersApi } from '../../vouchers/vouchersApi';

describe('ModalPrecuenta - comprobante, Pagó con y foto del POS', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vouchersApi, 'guardarPlanPago').mockResolvedValue({ ok: true } as any);
  });

  const propsBase = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    lineas: [{ cantidad: 1, nombre: 'Lomo saltado', detalle: '' }],
    total: 32.0,
  };

  const botonEnviar = () => screen.getByTestId('btn-enviar-caja');

  it('sin boleta ni factura no deja enviar: hay que elegir el comprobante (no hay nota de venta)', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-1" />);

    expect(screen.getByTestId('comprobante-BOLETA')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('comprobante-FACTURA')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('comprobante-NOTA_VENTA')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/^Mínimo S\/|^Obligatorio$/), { target: { value: '50' } });
    expect(botonEnviar()).toBeDisabled();

    fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
    expect(botonEnviar()).not.toBeDisabled();
    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));

    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    expect(enviar).toHaveBeenCalledWith('P-1', 'EFECTIVO', [{ medio: 'EFECTIVO', monto: 32 }], {
      recibido: 50,
      comprobante: { tipo: 'BOLETA' },
    });
  });

  it('efectivo sin «Pagó con» o menor que el total no deja enviar', () => {
    render(<ModalPrecuenta {...propsBase} pedidoId="P-1" />);
    expect(botonEnviar()).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/^Mínimo S\/|^Obligatorio$/), { target: { value: '20' } });
    expect(screen.getByText(/no alcanza: el efectivo es S\/ 32\.00/)).toBeInTheDocument();
    expect(botonEnviar()).toBeDisabled();
  });

  it('factura: RUC de 10 dígitos o sin razón social bloquea el envío; válida se envía', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} pedidoId="P-1" />);
    fireEvent.change(screen.getByPlaceholderText(/^Mínimo S\/|^Obligatorio$/), { target: { value: '50' } });

    fireEvent.click(screen.getByTestId('comprobante-FACTURA'));
    const [ruc] = screen.getAllByRole('textbox').filter((el) => el.getAttribute('maxlength') === '11');
    fireEvent.change(ruc, { target: { value: '1234567890' } });
    expect(screen.getByText(/El RUC debe tener 11 dígitos/)).toBeInTheDocument();
    expect(botonEnviar()).toBeDisabled();

    fireEvent.change(ruc, { target: { value: '20123456789' } });
    expect(botonEnviar()).toBeDisabled(); // falta la razón social
    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'Acme SAC' } });
    expect(botonEnviar()).not.toBeDisabled();

    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));
    await waitFor(() => expect(enviar).toHaveBeenCalledTimes(1));
    expect(enviar).toHaveBeenCalledWith('P-1', 'EFECTIVO', expect.anything(), {
      recibido: 50,
      comprobante: { tipo: 'FACTURA', doc: '20123456789', razon: 'Acme SAC' },
    });
  });

  it('boleta: el DNI es opcional, pero si se escribe son 8 dígitos', () => {
    render(<ModalPrecuenta {...propsBase} pedidoId="P-1" />);
    fireEvent.change(screen.getByPlaceholderText(/^Mínimo S\/|^Obligatorio$/), { target: { value: '50' } });
    fireEvent.click(screen.getByTestId('comprobante-BOLETA'));
    expect(botonEnviar()).not.toBeDisabled();
    const dni = screen.getByLabelText('DNI (opcional)');
    fireEvent.change(dni, { target: { value: '1234567' } });
    expect(screen.getByText(/El DNI debe tener 8 dígitos/)).toBeInTheDocument();
    expect(botonEnviar()).toBeDisabled();
  });

  it('tarjeta: pide la foto de la copia del POS y la sube con el mismo flujo que el voucher', () => {
    render(<ModalPrecuenta {...propsBase} pedidoId="P-1" />);
    fireEvent.click(screen.getByText('Tarjeta'));
    expect(screen.getByText('Foto de la copia del POS')).toBeInTheDocument();
    expect(screen.queryByText(/Foto del voucher \(TARJETA\)/)).toBeNull();
  });

  it('boleta o factura del pedido se usan de defecto', () => {
    render(
      <ModalPrecuenta
        {...propsBase}
        pedidoId="P-1"
        comprobantePedido={{ tipo: 'FACTURA', documento: '20123456789', razon: 'Acme SAC' }}
      />,
    );
    expect(screen.getByTestId('comprobante-FACTURA')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByDisplayValue('Acme SAC')).toBeInTheDocument();
  });
});
