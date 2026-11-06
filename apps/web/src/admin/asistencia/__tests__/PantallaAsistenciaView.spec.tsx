import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pantallaQr = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({ ...(await orig<any>()), pantallaQr: (...a: any[]) => pantallaQr(...a) }));

import { PantallaAsistenciaView } from '../PantallaAsistenciaView';

const respuesta = (ahora: number, slot: number, codigo: string) => ({
  slot,
  ahora,
  cambiaEn: (slot + 1) * 30_000,
  ventanaSeg: 30,
  qr: `data:image/png;base64,${slot}`,
  codigo,
});

describe('PantallaAsistenciaView (QR de asistencia)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T13:00:10Z'));
    pantallaQr.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pide el QR, muestra el código corto y la cuenta regresiva', async () => {
    const slot = Math.floor(Date.parse('2026-11-06T13:00:10Z') / 30_000);
    pantallaQr.mockResolvedValue(respuesta(Date.parse('2026-11-06T13:00:10Z'), slot, '123 456'));
    await act(async () => {
      render(<PantallaAsistenciaView />);
    });
    expect(screen.getByTestId('qr-asistencia')).toHaveAttribute('src', `data:image/png;base64,${slot}`);
    expect(screen.getByTestId('codigo-corto')).toHaveTextContent('123 456');
    // 10 s del 13:00:00 de la ranura: quedan 20 s
    expect(screen.getByTestId('cuenta-regresiva')).toHaveTextContent('El código cambia en 20 s');
  });

  it('renueva el QR al cambiar la ranura de 30 s', async () => {
    const slot = Math.floor(Date.parse('2026-11-06T13:00:10Z') / 30_000);
    pantallaQr
      .mockResolvedValueOnce(respuesta(Date.parse('2026-11-06T13:00:10Z'), slot, '111 111'))
      .mockResolvedValueOnce(respuesta(Date.parse('2026-11-06T13:00:30Z') + 1000, slot + 1, '222 222'));
    await act(async () => {
      render(<PantallaAsistenciaView />);
    });
    expect(pantallaQr).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(20_100);
    });
    expect(pantallaQr).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('codigo-corto')).toHaveTextContent('222 222');
  });
});
