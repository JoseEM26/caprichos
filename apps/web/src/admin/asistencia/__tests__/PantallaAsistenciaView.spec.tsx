import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pantallaQr = vi.fn();
const pantallaQrPublica = vi.fn();
vi.mock('../asistenciaApi', async (orig) => ({
  ...(await orig<any>()),
  pantallaQr: (...a: any[]) => pantallaQr(...a),
  pantallaQrPublica: (...a: any[]) => pantallaQrPublica(...a),
}));

import { ErrorApi } from '../../../comun/api';
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
    pantallaQrPublica.mockReset();
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

  describe('pantalla pública con enlace secreto', () => {
    it('pide el QR con el token y lo muestra', async () => {
      const slot = Math.floor(Date.parse('2026-11-06T13:00:10Z') / 30_000);
      pantallaQrPublica.mockResolvedValue(respuesta(Date.parse('2026-11-06T13:00:10Z'), slot, '123 456'));
      await act(async () => {
        render(<PantallaAsistenciaView token="tok-123" />);
      });
      expect(pantallaQrPublica).toHaveBeenCalledWith('tok-123');
      expect(pantallaQr).not.toHaveBeenCalled();
      expect(screen.getByTestId('qr-asistencia')).toHaveAttribute('src', `data:image/png;base64,${slot}`);
      expect(screen.getByTestId('codigo-corto')).toHaveTextContent('123 456');
    });

    it('si falla la red, reintenta y luego muestra el QR', async () => {
      const slot = Math.floor(Date.parse('2026-11-06T13:00:10Z') / 30_000);
      pantallaQrPublica
        .mockRejectedValueOnce(new ErrorApi('ERROR_RED', 'sin red'))
        .mockResolvedValueOnce(respuesta(Date.parse('2026-11-06T13:00:10Z'), slot, '777 777'));
      await act(async () => {
        render(<PantallaAsistenciaView token="tok-123" />);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Reintentando');
      await act(async () => {
        vi.advanceTimersByTime(5_100);
      });
      expect(pantallaQrPublica).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('codigo-corto')).toHaveTextContent('777 777');
    });

    it('con enlace inválido (404) avisa y no reintenta', async () => {
      pantallaQrPublica.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'Not Found', 404));
      await act(async () => {
        render(<PantallaAsistenciaView token="viejo" />);
      });
      expect(screen.getByRole('alert')).toHaveTextContent('Este enlace ya no es válido');
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });
      expect(pantallaQrPublica).toHaveBeenCalledTimes(1);
    });
  });

  describe('instalar app QR Asistencia', () => {
    const ok = () => {
      const slot = Math.floor(Date.parse('2026-11-06T13:00:10Z') / 30_000);
      pantallaQrPublica.mockResolvedValue(respuesta(Date.parse('2026-11-06T13:00:10Z'), slot, '123 456'));
    };
    const media = (match: boolean) =>
      (window.matchMedia = vi.fn().mockReturnValue({ matches: match, addEventListener() {}, removeEventListener() {} }) as any);
    beforeEach(() => {
      media(false);
      document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#111111">';
      document.title = 'Caprichos';
    });

    it('con beforeinstallprompt muestra el botón y llama prompt()', async () => {
      ok();
      await act(async () => {
        render(<PantallaAsistenciaView token="tok" />);
      });
      const ev: any = new Event('beforeinstallprompt', { cancelable: true });
      ev.prompt = vi.fn().mockResolvedValue(undefined);
      await act(async () => {
        window.dispatchEvent(ev);
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Instalar app QR Asistencia' }).click();
      });
      expect(ev.prompt).toHaveBeenCalled();
    });

    it('sin el evento muestra ayuda de pasos', async () => {
      ok();
      await act(async () => {
        render(<PantallaAsistenciaView token="tok" />);
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Instalar app QR Asistencia' }).click();
      });
      expect(screen.getByRole('note')).toHaveTextContent('menú del navegador');
    });

    it('en iOS la ayuda dice Compartir y Añadir a pantalla de inicio', async () => {
      ok();
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)');
      await act(async () => {
        render(<PantallaAsistenciaView token="tok" />);
      });
      await act(async () => {
        screen.getByRole('button', { name: 'Instalar app QR Asistencia' }).click();
      });
      expect(screen.getByRole('note')).toHaveTextContent('Toca Compartir y luego Añadir a pantalla de inicio.');
      vi.restoreAllMocks();
    });

    it('oculto cuando ya corre instalada y en la variante admin', async () => {
      ok();
      media(true);
      await act(async () => {
        render(<PantallaAsistenciaView token="tok" />);
      });
      expect(screen.queryByRole('button', { name: /Instalar app/ })).toBeNull();
    });

    it('la variante admin no muestra el botón ni toca el manifest', async () => {
      pantallaQr.mockResolvedValue(respuesta(Date.parse('2026-11-06T13:00:10Z'), 1, '1'));
      await act(async () => {
        render(<PantallaAsistenciaView />);
      });
      expect(screen.queryByRole('button', { name: /Instalar app/ })).toBeNull();
      expect(document.querySelector('link[rel="manifest"]')!.getAttribute('href')).toBe('/manifest.webmanifest');
    });

    it('cambia el manifest, el tema y el título, y los restaura al desmontar', async () => {
      ok();
      let r: any;
      await act(async () => {
        r = render(<PantallaAsistenciaView token="tok" />);
      });
      expect(document.querySelector('link[rel="manifest"]')!.getAttribute('href')).toBe('/carta/asistencia-pantalla/tok/manifest.webmanifest');
      expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe('#0B2C3E');
      expect(document.title).toBe('QR Asistencia');
      r.unmount();
      expect(document.querySelector('link[rel="manifest"]')!.getAttribute('href')).toBe('/manifest.webmanifest');
      expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe('#111111');
      expect(document.title).toBe('Caprichos');
    });
  });
});
