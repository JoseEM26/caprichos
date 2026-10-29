import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
  BannerVouchersIaPausa,
  hayPausaVouchersIa,
  INTERVALO_ESTADO_IA_MS,
  TEXTO_VOUCHERS_IA_PAUSA,
} from '../BannerVouchersIaPausa';
import { vouchersApi, EstadoIaVouchers } from '../vouchersApi';

vi.mock('../vouchersApi', () => ({
  vouchersApi: { obtenerEstadoIa: vi.fn() },
}));

const estado = (parcial: Partial<EstadoIaVouchers> & { superado?: boolean } = {}): EstadoIaVouchers => ({
  activa: true,
  enPausa: false,
  causa: null,
  hastaEn: null,
  topeMensual: { usadoUsd: 1, topeUsd: 20, superado: parcial.superado ?? false },
  ...parcial,
});

describe('hayPausaVouchersIa', () => {
  it('solo se activa con pausa o tope superado', () => {
    expect(hayPausaVouchersIa(null)).toBe(false);
    expect(hayPausaVouchersIa(estado())).toBe(false);
    expect(hayPausaVouchersIa(estado({ enPausa: true, causa: 'SALDO' }))).toBe(true);
    expect(hayPausaVouchersIa(estado({ superado: true }))).toBe(true);
  });
});

describe('BannerVouchersIaPausa', () => {
  beforeEach(() => {
    vi.mocked(vouchersApi.obtenerEstadoIa).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra la franja con el texto acordado cuando la lectura está en pausa', async () => {
    vi.mocked(vouchersApi.obtenerEstadoIa).mockResolvedValue(
      estado({ enPausa: true, causa: 'SALDO', hastaEn: '2026-10-29T06:10:00.000Z' }),
    );

    render(<BannerVouchersIaPausa />);

    const franja = await screen.findByTestId('banner-vouchers-ia-pausa');
    expect(franja).toHaveTextContent(
      'Lectura automática de vouchers en pausa: revisa los vouchers a ojo',
    );
    expect(TEXTO_VOUCHERS_IA_PAUSA).toBe(
      'Lectura automática de vouchers en pausa: revisa los vouchers a ojo',
    );
    expect(franja).not.toHaveTextContent(/tope mensual/i);
  });

  it('indica el tope mensual cuando se superó', async () => {
    vi.mocked(vouchersApi.obtenerEstadoIa).mockResolvedValue(estado({ superado: true }));

    render(<BannerVouchersIaPausa />);

    const franja = await screen.findByTestId('banner-vouchers-ia-pausa');
    expect(franja).toHaveTextContent('tope mensual de IA alcanzado');
  });

  it('no muestra nada si la lectura funciona normal', async () => {
    vi.mocked(vouchersApi.obtenerEstadoIa).mockResolvedValue(estado());

    render(<BannerVouchersIaPausa />);

    await waitFor(() => expect(vouchersApi.obtenerEstadoIa).toHaveBeenCalled());
    expect(screen.queryByTestId('banner-vouchers-ia-pausa')).toBeNull();
  });

  it('no muestra nada si la consulta del estado falla', async () => {
    vi.mocked(vouchersApi.obtenerEstadoIa).mockRejectedValue(new Error('403'));

    render(<BannerVouchersIaPausa />);

    await waitFor(() => expect(vouchersApi.obtenerEstadoIa).toHaveBeenCalled());
    expect(screen.queryByTestId('banner-vouchers-ia-pausa')).toBeNull();
  });

  it('vuelve a consultar el estado cada 60 segundos', async () => {
    vi.useFakeTimers();
    vi.mocked(vouchersApi.obtenerEstadoIa).mockResolvedValue(estado());

    render(<BannerVouchersIaPausa />);
    await act(async () => {});
    expect(vouchersApi.obtenerEstadoIa).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(INTERVALO_ESTADO_IA_MS);
    });
    expect(vouchersApi.obtenerEstadoIa).toHaveBeenCalledTimes(2);
    expect(INTERVALO_ESTADO_IA_MS).toBe(60_000);
  });
});
