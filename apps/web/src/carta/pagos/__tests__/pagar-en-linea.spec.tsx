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
  it('no aparece si activo=false', async () => {
    vi.spyOn(culqiApi, 'config').mockResolvedValue({ ...config, activo: false });
    const { container } = render(<PagarEnLinea pedidoId="p1" />);
    await waitFor(() => expect(culqiApi.config).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe('');
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
