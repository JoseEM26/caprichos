import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';

describe('ModalPrecuenta - diseño de la precuenta', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const base = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    total: 19,
    lineas: [{ cantidad: 1, nombre: 'FRAPPE BERRIES', detalle: 'Grande · Chantilly', precio: 19 }],
  };

  it('cabecera con título, mesa y mozo; sin líneas de guiones', () => {
    const { container } = render(<ModalPrecuenta {...base} mozo="Ana" />);

    const dialogo = screen.getByRole('dialog', { name: 'Precuenta' });
    expect(within(dialogo).getByText('Precuenta')).toBeInTheDocument();
    expect(within(dialogo).getByText('Mesa 4')).toBeInTheDocument();
    expect(within(dialogo).getByText('Mozo: Ana')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/-{5,}/);
  });

  it('lista cada producto en fila: cantidad, nombre, detalle en gris y precio a la derecha', () => {
    render(<ModalPrecuenta {...base} />);

    const lista = screen.getByRole('list', { name: 'Productos' });
    expect(within(lista).getByText('FRAPPE BERRIES')).toBeInTheDocument();
    expect(within(lista).getByText('Grande · Chantilly')).toHaveClass('pc-detalle');
    expect(within(lista).getByText('S/ 19.00')).toHaveClass('pc-precio');
  });

  it('total destacado y subtotal/descuento si vienen', () => {
    render(<ModalPrecuenta {...base} total={17} subtotal={19} descuento={2} />);

    expect(screen.getByText('TOTAL').parentElement).toHaveClass('pc-total');
    expect(screen.getByText('S/ 17.00').parentElement).toHaveClass('pc-total');
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Descuento')).toBeInTheDocument();
    expect(screen.getByText('- S/ 2.00')).toBeInTheDocument();
  });

  it('sin subtotal ni descuento no muestra esas filas', () => {
    render(<ModalPrecuenta {...base} />);
    expect(screen.queryByText('Subtotal')).toBeNull();
    expect(screen.queryByText('Descuento')).toBeNull();
  });

  it('con plan dividido muestra el desglose por medio', () => {
    render(
      <ModalPrecuenta
        {...base}
        total={30}
        plan={[
          { medio: 'EFECTIVO', monto: 10 },
          { medio: 'YAPE', monto: '20.00' },
        ]}
      />,
    );

    expect(screen.getByText('Efectivo S/ 10.00 · Yape S/ 20.00')).toBeInTheDocument();
  });

  it('sin plan (o con montos vacíos) no muestra desglose', () => {
    render(<ModalPrecuenta {...base} plan={[{ medio: 'YAPE', monto: 0 }]} />);
    expect(screen.queryByText(/Yape S\//)).toBeNull();
  });

  it('bloque «Cómo pagar» con dos tarjetas: Yape o Plin y Efectivo', () => {
    render(<ModalPrecuenta {...base} />);

    const como = screen.getByRole('region', { name: 'Cómo pagar' });
    expect(within(como).getByText('Yape o Plin')).toBeInTheDocument();
    expect(within(como).getByText('Efectivo')).toBeInTheDocument();
    expect(within(como).getByText(/Entrega el efectivo al mozo/)).toBeInTheDocument();
  });

  it('aviso de que la precuenta no es comprobante, como nota al pie', () => {
    render(<ModalPrecuenta {...base} />);
    const aviso = screen.getByText('La precuenta no es un comprobante de pago.');
    expect(aviso).toHaveClass('pc-aviso');
  });

  it('pie fijo con Imprimir y Cerrar; Cerrar llama alCerrar', () => {
    const alCerrar = vi.fn();
    render(<ModalPrecuenta {...base} alCerrar={alCerrar} />);

    const pie = screen.getByRole('button', { name: 'Imprimir precuenta' }).parentElement;
    expect(pie).toHaveClass('pc-pie');
    screen.getByRole('button', { name: 'Cerrar' }).click();
    expect(alCerrar).toHaveBeenCalled();
  });

  it('el medio elegido en el envío a Caja queda marcado con aria-pressed', () => {
    render(<ModalPrecuenta {...base} pedidoId="P-1" />);

    const efectivo = screen.getByRole('button', { name: 'Efectivo' });
    expect(efectivo).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Yape' })).toHaveAttribute('aria-pressed', 'false');
  });
});
