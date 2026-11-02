import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';

/** Con efectivo en el plan, «¿Con cuánto paga?» es obligatorio: lo escribe el mozo antes de enviar. */
const llenarPagaCon = () => {
  const campo = screen.queryByPlaceholderText(/^Mínimo S\/|^Obligatorio$/);
  if (campo) fireEvent.change(campo, { target: { value: '100' } });
};


describe('ModalPrecuenta - pago en mesa con plan (un medio o dividido)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // El plan se guarda antes de cada captura (ver ModalPrecuenta.guardarPlan)
    vi.spyOn(vouchersApi, 'guardarPlanPago').mockResolvedValue({ ok: true } as any);
  });

  const propsBase = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    lineas: [{ cantidad: 2, nombre: 'Frappé Moka', detalle: 'Grande · Chantilly' }],
    total: 32,
    pedidoId: 'P-20',
  };

  const botonEnviar = () => screen.getByTestId('btn-enviar-caja');

  it('muestra el editor de pago (el mismo del alta de mesa) con todo en efectivo por el total', () => {
    render(<ModalPrecuenta {...propsBase} />);

    expect(screen.getByText('¿Cómo paga?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Efectivo' })).toHaveAttribute('aria-pressed', 'true');
    // Un medio paga todo el total: sin campo de monto
    expect(screen.queryByLabelText(/Monto en/)).toBeNull();
  });

  it('precarga el plan que ya tiene el pedido', () => {
    render(
      <ModalPrecuenta
        {...propsBase}
        plan={[
          { medio: 'YAPE', monto: 20 },
          { medio: 'EFECTIVO', monto: '12.00' },
        ]}
      />,
    );

    const primerMedio = screen.getByRole('group', { name: '¿Cómo paga?' });
    expect(within(primerMedio).getByRole('button', { name: 'Yape' })).toHaveAttribute('aria-pressed', 'true');
    // La primera fila (Yape) queda con el resto del total; la segunda (Efectivo) se escribe
    expect(screen.getByLabelText('Monto en Yape')).toHaveTextContent('S/ 20.00');
    expect(screen.getByLabelText('Monto en Efectivo')).toHaveValue(12);
    expect(screen.getByText('¿Con cuánto paga?')).toBeInTheDocument();
  });

  it('pago dividido: envía el plan completo y el medio principal (el digital)', async () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    // La foto de Yape ya está subida y se lee: sin ella Caja no recibe el envío
    render(<ModalPrecuenta {...propsBase} vouchersPorMedio={[{ medio: 'YAPE', monto: 12, subido: true }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '12' } });
    expect(screen.getByLabelText('Monto en Yape')).toBeInTheDocument();
    expect(screen.getByLabelText('Resumen del pago')).toHaveTextContent('Efectivo S/ 20.00 · Yape S/ 12.00');

    llenarPagaCon();
    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));

    await waitFor(() => {
      expect(enviar).toHaveBeenCalledWith('P-20', 'YAPE', [
        { medio: 'EFECTIVO', monto: 20 },
        { medio: 'YAPE', monto: 12 },
      ], expect.anything());
    });
  });

  it('pago dividido: la confirmación muestra el desglose y no pide foto para la parte en efectivo', () => {
    render(<ModalPrecuenta {...propsBase} vouchersPorMedio={[{ medio: 'YAPE', monto: 12, subido: true }]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '12' } });

    llenarPagaCon();
    fireEvent.click(botonEnviar());
    expect(screen.getByText(/Caja cobrará S\/ 32\.00 \(Efectivo S\/ 20\.00 · Yape S\/ 12\.00\)/)).toBeInTheDocument();
    expect(screen.getByTestId('voucher-ya-subido-YAPE')).toBeInTheDocument();
    expect(screen.queryByText(/Voucher Efectivo/)).toBeNull();
  });

  it('pago dividido con Yape sin foto subida: Enviar a Caja queda bloqueado y pide la foto', () => {
    render(<ModalPrecuenta {...propsBase} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '12' } });
    llenarPagaCon();

    expect(botonEnviar()).toBeDisabled();
    expect(screen.getByText(/Falta la foto de Yape/)).toBeInTheDocument();
  });

  it('segundo medio sin monto: bloquea Enviar a Caja y pide el monto', () => {
    const enviar = vi.spyOn(vouchersApi, 'enviarACaja').mockResolvedValue({ ok: true });
    render(<ModalPrecuenta {...propsBase} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Indica el monto de cada medio');
    expect(botonEnviar()).toBeDisabled();
    llenarPagaCon();
    fireEvent.click(botonEnviar());
    expect(screen.queryByText('Sí, enviar a Caja')).toBeNull();
    expect(enviar).not.toHaveBeenCalled();
  });

  it('si el segundo medio supera el total: bloquea y avisa lo que sobra', () => {
    render(<ModalPrecuenta {...propsBase} />);

    fireEvent.click(screen.getByRole('button', { name: 'Agregar otro medio de pago' }));
    fireEvent.change(screen.getByLabelText('Monto en Yape'), { target: { value: '40' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Sobra S/ 8.00: baja los montos de los otros medios');
    expect(botonEnviar()).toBeDisabled();
  });

  it('el voucher de la parte digital va opcional y con el medio principal del plan', async () => {
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    const subir = vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'vch-9', legible: true });
    render(
      <ModalPrecuenta
        {...propsBase}
        plan={[
          { medio: 'EFECTIVO', monto: 12 },
          { medio: 'YAPE', monto: 20 },
        ]}
      />,
    );

    const seccion = screen.getByTestId('seccion-subir-voucher-mozo');
    expect(within(seccion).getByText(/Foto del voucher \(YAPE\)/)).toBeInTheDocument();
    expect(within(seccion).getByText(/Opcional ahora/)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'voucher.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(screen.getByText('Foto del voucher lista para confirmar')).toBeInTheDocument());
    expect(subir).toHaveBeenCalledWith(expect.anything(), 'P-20', 'YAPE');
  });

  it('sin parte digital no muestra la sección del voucher', () => {
    render(<ModalPrecuenta {...propsBase} />);
    expect(screen.queryByTestId('seccion-subir-voucher-mozo')).toBeNull();
    expect(screen.getByTestId('aviso-efectivo-caja')).toBeInTheDocument();
  });

  it('si el envío falla, muestra el error y deja reintentar con el mismo plan', async () => {
    const enviar = vi
      .spyOn(vouchersApi, 'enviarACaja')
      .mockRejectedValueOnce(new Error('Sin conexión con el servidor'))
      .mockResolvedValueOnce({ ok: true });
    render(<ModalPrecuenta {...propsBase} />);

    llenarPagaCon();
    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión con el servidor'));

    llenarPagaCon();
    fireEvent.click(botonEnviar());
    fireEvent.click(screen.getByText('Sí, enviar a Caja'));
    await waitFor(() => expect(screen.getByTestId('aviso-enviado-caja')).toBeInTheDocument());
    expect(enviar).toHaveBeenNthCalledWith(2, 'P-20', 'EFECTIVO', [{ medio: 'EFECTIVO', monto: 32 }], expect.anything());
  });
});
