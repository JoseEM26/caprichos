import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const abrir = vi.fn();
vi.mock('../culqiApi', async (orig) => ({ ...(await orig<typeof import('../culqiApi')>()), abrirCulqi: (...a: unknown[]) => abrir(...a) }));
import { culqiApi } from '../culqiApi';
import * as tres from '../culqi3ds';
import { PagarEnLinea } from '../PagarEnLinea';

const config = { activo: true, publicKey: 'pk_test_1', modo: 'REAL' as const, medios: ['TARJETA', 'YAPE'] as any };
const intento = { intentoId: 'i1', montoCentimos: 1350, moneda: 'PEN' as const, descripcion: 'x', publicKey: 'pk_test_1', modo: 'REAL' as const, medios: config.medios };

beforeEach(() => {
  abrir.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(culqiApi, 'config').mockResolvedValue(config);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
});

describe('pago en línea recién creado', () => {
  it('abre Culqi solo y, si se cierra sin pagar, muestra «Falta pagar» con el contador', async () => {
    abrir.mockReturnValue({ resultado: Promise.resolve(null), cerrar: vi.fn() });
    render(<PagarEnLinea pedidoId="p1" auto monto={13.5} creadoEn={new Date(Date.now() - 5 * 60000).toISOString()} />);
    await waitFor(() => expect(abrir).toHaveBeenCalledTimes(1));
    expect((await screen.findByTestId('falta-pagar')).textContent).toBe('Falta pagar S/ 13.50');
    expect(screen.getByTestId('contador-pago').textContent).toMatch(/Te quedan 10 min/);
    expect(screen.getByText('Pagar ahora')).toBeTruthy();
  });

  it('sin auto no abre nada solo', async () => {
    render(<PagarEnLinea pedidoId="p1" monto={13.5} />);
    await screen.findByText('Pagar ahora');
    expect(abrir).not.toHaveBeenCalled();
  });

  it('Culqi se muestra DENTRO de nuestro modal (contenedor) y Volver lo cierra y deja «Pagar ahora»', async () => {
    const cerrar = vi.fn();
    abrir.mockReturnValue({ resultado: new Promise(() => {}), cerrar });
    render(<PagarEnLinea pedidoId="p1" monto={13.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    const cont = await screen.findByTestId('culqi-embebido');
    expect(cont.querySelector('.sg-culqi')).toBeTruthy();
    await waitFor(() => expect(abrir).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Volver'));
    expect(await screen.findByText('Pagar ahora')).toBeTruthy();
    expect(screen.queryByTestId('culqi-embebido')).toBeNull();
    expect(cerrar).toHaveBeenCalled();
  });

  it('con el token de Culqi cobra y muestra el pago aprobado', async () => {
    abrir.mockReturnValue({ resultado: Promise.resolve({ token: 'tkn_1', medio: 'TARJETA' }), cerrar: vi.fn() });
    vi.spyOn(tres, 'obtenerDeviceId').mockResolvedValue('dev_1');
    const cargo = vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" auto monto={13.5} />);
    await screen.findByTestId('pago-aprobado');
    expect(cargo.mock.calls[0][0]).toMatchObject({ token: 'tkn_1', medio: 'TARJETA' });
  });
});
