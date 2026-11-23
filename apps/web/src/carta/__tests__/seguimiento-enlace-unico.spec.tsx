import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { leerEnlaceSeguimiento, quitarEnlaceSeguimiento } from '../seguimiento';

const TOKEN = 'b'.repeat(64);

vi.mock('../../comun/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ codigo: 'CP-NUEVO', estado: 'POR_PAGAR', estadoEtiqueta: 'Por pagar', modalidad: 'RECOGER', total: 13.5, terminado: false, anulado: false, pasos: [], resumenPago: { total: 13.5, pagado: 0, pagos: [] }, pagoEnLinea: { pedidoId: '1', creadoEn: new Date().toISOString() } }), post: vi.fn() },
  clienteFetch: vi.fn().mockResolvedValue({}),
  ErrorApi: class ErrorApi extends Error {},
}));
vi.mock('../pagos/PagarEnLinea', () => ({ PagarEnLinea: (p: { auto?: boolean }) => <div data-testid="pagar" data-auto={String(p.auto)} /> }));
vi.mock('../../pwa/BannerInstalarApp', () => ({ BannerInstalarApp: () => null }));
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({
    pedidoConfirmado: { id: 'p2', codigo: 'CP-NUEVO', seguimientoToken: 't2', modalidad: 'RECOGER', clienteNombre: 'Ana', enLinea: true, creadoEn: new Date().toISOString(), total: 13.5 },
    setPedidoConfirmado: vi.fn(),
    seguimientoAbierto: null,
    setSeguimientoAbierto: vi.fn(),
  }),
}));
import { PantallaConfirmacion } from '../PantallaConfirmacion';

describe('enlace de seguimiento de un solo uso', () => {
  it('se limpia de la dirección y al recargar ya no hay enlace; lo demás se conserva', () => {
    window.history.replaceState(null, '', `/?mesa=3&seguimiento=CP-W420&t=${TOKEN}#x`);
    expect(leerEnlaceSeguimiento()).not.toBeNull();
    quitarEnlaceSeguimiento();
    expect(leerEnlaceSeguimiento()).toBeNull();
    expect(window.location.search).toBe('?mesa=3');
    expect(window.location.hash).toBe('#x');
  });
});

describe('pedido nuevo', () => {
  it('la confirmación muestra el nuevo y abre el pago en línea solo', async () => {
    render(<PantallaConfirmacion />);
    expect((await screen.findAllByText(/CP-NUEVO/)).length).toBeGreaterThan(0);
    expect((await screen.findByTestId('pagar')).dataset.auto).toBe('true');
  });
});

describe('pedido en efectivo o contra entrega', () => {
  it('no muestra el pago en línea ni su contador aunque falte pagar', async () => {
    const { api } = await import('../../comun/api');
    (api.get as any).mockResolvedValueOnce({ codigo: 'CP-EFEC', estado: 'COLA', estadoEtiqueta: 'En cola', modalidad: 'RECOGER', total: 66.5, terminado: false, anulado: false, pasos: [], resumenPago: { total: 66.5, pagado: 0, pagos: [] } });
    render(<PantallaConfirmacion />);
    await screen.findAllByText(/CP-NUEVO/);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('pagar')).toBeNull();
  });
});
