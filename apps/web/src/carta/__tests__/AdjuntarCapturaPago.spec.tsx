import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdjuntarCapturaPago } from '../AdjuntarCapturaPago';
import * as reducirModulo from '../../admin/vouchers/reducirImagenVoucher';

// Carta: la captura del pago se adjunta desde el seguimiento, con el token del pedido.
describe('AdjuntarCapturaPago (carta, seguimiento)', () => {
  let fetchOriginal: typeof fetch;

  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it('no aparece si el pago no es digital (efectivo, tarjeta)', () => {
    const { container } = render(
      <AdjuntarCapturaPago codigo="CP-1" token="tok" pagoDigital={false} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('sube la captura al endpoint del pedido con el token y confirma sin mostrar semáforo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: '5', legible: true, recibido: true }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<AdjuntarCapturaPago codigo="CP-1" token="tok123" pagoDigital />);
    const input = screen.getByTestId('input-captura-pago');
    fireEvent.change(input, { target: { files: [new File(['captura'], 'yape.jpg', { type: 'image/jpeg' })] } });

    expect(await screen.findByText(/Recibimos tu captura/i)).toBeDefined();
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/carta/seguimiento/CP-1/comprobante?t=tok123');
    expect(opciones.method).toBe('POST');
    expect(opciones.body).toBeInstanceOf(FormData);
    expect(screen.queryByText(/semáforo|Confiable|Ilegible/i)).toBeNull();
  });

  it('si el servidor rechaza la captura muestra el error y permite reintentar', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ codigo: 'PEDIDO_ANULADO', mensaje: 'El pedido fue anulado; no se puede adjuntar el pago' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    render(<AdjuntarCapturaPago codigo="CP-1" token="tok" pagoDigital />);
    fireEvent.change(screen.getByTestId('input-captura-pago'), {
      target: { files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(screen.getByTestId('input-captura-pago')).toBeDefined();
  });
});
