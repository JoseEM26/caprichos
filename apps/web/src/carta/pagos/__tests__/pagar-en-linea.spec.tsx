import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { culqiApi } from '../culqiApi';
import { PagarEnLinea } from '../PagarEnLinea';

const config = { activo: true, publicKey: null, modo: 'SIMULADO' as const, medios: ['TARJETA', 'YAPE'] as any };
const intento = { intentoId: 'i1', montoCentimos: 2500, moneda: 'PEN' as const, descripcion: 'x', publicKey: null, modo: 'SIMULADO' as const, medios: config.medios };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(culqiApi, 'config').mockResolvedValue(config);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
});

describe('PagarEnLinea', () => {
  it('con activo=false no ofrece pagar, pero dice qué hacer (cambiar el medio)', async () => {
    vi.spyOn(culqiApi, 'config').mockResolvedValue({ ...config, activo: false });
    render(<PagarEnLinea pedidoId="p1" />);
    expect(await screen.findByTestId('pago-no-disponible')).toBeTruthy();
    expect(screen.queryByText('Pagar ahora')).toBeNull();
    expect(screen.getByRole('button', { name: 'Cambiar medio de pago' })).toBeTruthy();
  });

  it('pago aprobado muestra que ya está en cocina', async () => {
    const cargo = vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    expect((await screen.findByTestId('pago-aprobado')).textContent).toMatch(/ya está en cocina/);
    expect(cargo).toHaveBeenCalledWith({ intentoId: 'i1', token: 'tkn_simulado_ok', medio: 'TARJETA' });
  });

  it('rechazado permite reintentar', async () => {
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'RECHAZADO', mensaje: 'Fondos insuficientes.', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta rechazada'));
    expect((await screen.findByTestId('pago-rechazado')).textContent).toMatch(/Fondos insuficientes/);
    expect((screen.getByText('Probar Yape aprobado') as HTMLButtonElement).disabled).toBe(false);
  });

  it('doble clic no paga dos veces', async () => {
    const cargo = vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    const b = await screen.findByText('Probar tarjeta aprobada');
    fireEvent.click(b);
    fireEvent.click(b);
    await screen.findByTestId('pago-aprobado');
    expect(cargo).toHaveBeenCalledTimes(1);
    expect(culqiApi.intento).toHaveBeenCalledTimes(1);
  });

  it('error de red deja reintentar', async () => {
    vi.spyOn(culqiApi, 'cargo').mockRejectedValue(new Error('x'));
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    expect(await screen.findByTestId('pago-error')).toBeTruthy();
  });
});

describe('PagarEnLinea (ajustes)', () => {
  it('manda el token de seguimiento al pedir el intento', async () => {
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'APROBADO', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" token="seg1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    await screen.findByTestId('pago-aprobado');
    expect(culqiApi.intento).toHaveBeenCalledWith('p1', 'seg1');
  });

  it('PENDIENTE no ofrece reintentar', async () => {
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'PENDIENTE', mensaje: '', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    expect((await screen.findByTestId('pago-pendiente')).textContent).toMatch(/no vuelvas a pagar/);
    expect(screen.queryByText('Probar tarjeta aprobada')).toBeNull();
  });

  it('tras un rechazo pide un intento nuevo', async () => {
    vi.spyOn(culqiApi, 'cargo').mockResolvedValue({ estado: 'RECHAZADO', mensaje: 'x', pedidoCodigo: 'A1' });
    render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta rechazada'));
    await screen.findByTestId('pago-rechazado');
    fireEvent.click(screen.getByText('Probar Yape aprobado'));
    await waitFor(() => expect(culqiApi.intento).toHaveBeenCalledTimes(2));
  });

  it('PAGO_ONLINE_APAGADO oculta el pago', async () => {
    const { ErrorApi } = await import('../../../comun/api');
    vi.spyOn(culqiApi, 'intento').mockRejectedValue(new ErrorApi('PAGO_ONLINE_APAGADO', 'apagado', 403));
    const { container } = render(<PagarEnLinea pedidoId="p1" />);
    fireEvent.click(await screen.findByText('Probar tarjeta aprobada'));
    await waitFor(() => expect(container.textContent).toBe(''));
  });
});
