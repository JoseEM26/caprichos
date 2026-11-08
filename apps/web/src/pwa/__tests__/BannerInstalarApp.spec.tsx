import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

const CLAVE = 'caprichos.pwa.instalar.descartado';
const UA_ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';

function ponerUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function dispararInstalable() {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome: 'dismissed' });
  act(() => {
    window.dispatchEvent(evento);
  });
  return evento;
}

/** Cada prueba parte de un módulo limpio (el evento diferido vive a nivel de módulo). */
async function cargarBanner() {
  vi.resetModules();
  const pwa = await import('../instalar');
  pwa.iniciarCapturaInstalar();
  const { BannerInstalarApp } = await import('../BannerInstalarApp');
  return { BannerInstalarApp };
}

describe('BannerInstalarApp', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    ponerUserAgent(UA_ESCRITORIO);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('sin el evento del navegador (otro equipo, aviso ya usado) sigue ofreciendo los pasos manuales', async () => {
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);
    expect(screen.getByRole('button', { name: /Instalar app/ })).toBeDefined();
    // el panel del local tampoco pierde la opción
    render(<BannerInstalarApp compacto />);
    expect(screen.getAllByRole('button', { name: /Instalar app/ }).length).toBeGreaterThan(1);
  });

  it('aparece con el botón Instalar cuando llega el evento y llama al aviso del navegador', async () => {
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);
    const evento = dispararInstalable();

    expect(screen.getByRole('region', { name: 'Instalar Caprichos en tu celular' })).toBeDefined();
    const boton = screen.getByRole('button', { name: 'Instalar' });
    expect(boton.getAttribute('style')).toContain('min-height: 44px');

    fireEvent.click(boton);
    await act(async () => {});
    expect(evento.prompt).toHaveBeenCalledTimes(1);
  });

  it('la × lo oculta solo en esta sesión y reaparece con una sesión nueva', async () => {
    const { BannerInstalarApp } = await cargarBanner();
    const { unmount } = render(<BannerInstalarApp />);
    dispararInstalable();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso de instalación' }));
    expect(screen.queryByRole('region')).toBeNull();
    expect(window.sessionStorage.getItem(CLAVE)).toBe('1');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();

    // misma sesión de navegación: sigue oculto
    unmount();
    const { unmount: otraCarga } = render(<BannerInstalarApp />);
    dispararInstalable();
    expect(screen.queryByRole('region')).toBeNull();
    otraCarga();

    // sesión nueva (pestaña cerrada): vuelve a salir
    window.sessionStorage.clear();
    const { BannerInstalarApp: Nueva } = await cargarBanner();
    render(<Nueva />);
    dispararInstalable();
    expect(screen.getByRole('region', { name: 'Instalar Caprichos en tu celular' })).toBeDefined();
  });

  it('no aparece si ya se cerró en esta sesión de navegación', async () => {
    window.sessionStorage.setItem(CLAVE, '1');
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);
    dispararInstalable();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('en modo standalone (ya instalada) no aparece', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);
    dispararInstalable();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Instalar app' })).toBeNull();
    // el panel del local sí conserva el botón: sirve para reinstalar o buscar actualización
    render(<BannerInstalarApp compacto />);
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeDefined();
  });

  it('en iPhone muestra la guía Compartir > Añadir a pantalla de inicio, sin botón Instalar', async () => {
    ponerUserAgent(UA_IPHONE);
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);

    expect(screen.getByText(/Compartir/)).toBeDefined();
    expect(screen.getByText(/Añadir a pantalla de inicio/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Instalar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cerrar aviso de instalación' })).toBeDefined();
  });

  it('compacto (panel del local) ignora el descarte de la carta', async () => {
    window.sessionStorage.setItem(CLAVE, '1');
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp compacto />);
    dispararInstalable();
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeDefined();
  });

  it('compacto abre la ventana para elegir app (panel o asistencia, en el área administrativa)', async () => {
    window.history.pushState({}, '', '/admin/pedidos');
    ponerUserAgent(UA_IPHONE);
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp compacto />);

    fireEvent.click(screen.getByRole('button', { name: 'Instalar app' }));
    expect(screen.getByText('Panel administrativo')).toBeDefined();
    expect(screen.getByText('Asistencia (marcar entrada y salida)')).toBeDefined();
    window.history.pushState({}, '', '/');
  });

  it('si sessionStorage lanza, el aviso igual aparece y el cierre no rompe', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    const { BannerInstalarApp } = await cargarBanner();
    render(<BannerInstalarApp />);
    dispararInstalable();
    expect(screen.getByRole('region')).toBeDefined();
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso de instalación' }))).not.toThrow();
    vi.restoreAllMocks();
  });
});
