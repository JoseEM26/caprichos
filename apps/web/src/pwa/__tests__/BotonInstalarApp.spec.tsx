import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';

const UA_ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const NOMBRE_BOTON = 'Instalar app';
const TITULO = 'Instala Caprichos';
const TITULO_ADMIN = '¿Qué app quieres instalar?';

function ponerUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function dispararInstalable(resultado: 'accepted' | 'dismissed' = 'dismissed') {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome: resultado });
  act(() => {
    window.dispatchEvent(evento);
  });
  return evento;
}

/** Cada prueba parte de un módulo limpio: el evento diferido vive a nivel de módulo. */
async function cargarBoton() {
  vi.resetModules();
  const pwa = await import('../instalar');
  pwa.iniciarCapturaInstalar();
  const { BotonInstalarApp } = await import('../BotonInstalarApp');
  return { BotonInstalarApp };
}

function anchoVentana(px: number) {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true, writable: true });
}

describe('BotonInstalarApp (cabecera de la carta)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    ponerUserAgent(UA_ESCRITORIO);
    anchoVentana(1024);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    anchoVentana(1024);
  });

  it('aparece sin pedido y sin prompt: la explicación manual sigue disponible', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    expect(screen.getByRole('button', { name: NOMBRE_BOTON })).toBeDefined();
  });

  it('no aparece si la app ya está instalada (standalone)', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { BotonInstalarApp } = await cargarBoton();
    const { container } = render(<BotonInstalarApp />);
    expect(container).toBeEmptyDOMElement();
  });

  it('desaparece cuando llega appinstalled', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    expect(screen.getByRole('button', { name: NOMBRE_BOTON })).toBeDefined();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: NOMBRE_BOTON })).toBeNull();
  });

  it('en pantallas angostas (≤ 480 px) es solo el ícono, con nombre accesible', async () => {
    anchoVentana(400);
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    const boton = screen.getByRole('button', { name: 'Instalar app Caprichos' });
    expect(boton.textContent).toBe('');
    expect(boton.style.minHeight).toBe('44px');
    expect(boton.style.width).toBe('44px');
  });

  it('en escritorio muestra ícono y texto', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    expect(screen.getByRole('button', { name: NOMBRE_BOTON }).textContent).toBe(NOMBRE_BOTON);
  });

  it('al tocarlo abre el diálogo con título, ventajas y el botón de cerrar de 44 px', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));

    const dialogo = screen.getByRole('dialog', { name: TITULO });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('Caprichos (carta para pedir)')).toBeDefined();
    // en la carta pública NUNCA se ofrece la app administrativa ni la de asistencia
    expect(document.body.querySelector('[data-app="admin"]')).toBeNull();
    expect(document.body.querySelector('[data-app="asistencia"]')).toBeNull();
    expect(dialogo.textContent).not.toMatch(/administrativ|asistencia|admin/i);
    expect(screen.getByRole('button', { name: 'Cerrar' }).style.width).toBe('44px');
  });

  it('el diálogo se renderiza en document.body (portal)', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    const { container } = render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('Esc cierra el diálogo y devuelve el foco al botón', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    const boton = screen.getByRole('button', { name: NOMBRE_BOTON });
    fireEvent.click(boton);
    expect(screen.getByRole('dialog')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(boton);
  });

  it('el botón Cerrar y «Ahora no» también cierran', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  const tarjeta = (app: string) => within(document.body.querySelector(`[data-app="${app}"]`) as HTMLElement);

  it('con prompt disponible, «Instalar» de la app activa (carta) lanza el aviso del navegador', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    const evento = dispararInstalable('dismissed');
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));

    fireEvent.click(tarjeta('carta').getByRole('button', { name: 'Instalar' }));
    await act(async () => {});
    expect(evento.prompt).toHaveBeenCalledTimes(1);
  });

  it('en el panel: ofrece administrativa y asistencia (no la carta); la otra se abre en pestaña nueva con ?instalar=', async () => {
    window.history.pushState({}, '', '/admin/pedidos');
    const { BotonInstalarApp } = await cargarBoton();
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<BotonInstalarApp />);
    const evento = dispararInstalable();
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    expect(screen.getByRole('dialog', { name: TITULO_ADMIN })).toBeDefined();
    expect(document.body.querySelector('[data-app="carta"]')).toBeNull();

    fireEvent.click(tarjeta('asistencia').getByRole('button', { name: 'Instalar' }));
    expect(abrir).toHaveBeenCalledWith('/admin/mi-asistencia?instalar=asistencia', '_blank', 'noopener');
    expect(evento.prompt).not.toHaveBeenCalled();
    fireEvent.click(tarjeta('admin').getByRole('button', { name: 'Instalar' }));
    await act(async () => {});
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    abrir.mockRestore();
    window.history.pushState({}, '', '/');
  });

  it('un aviso capturado en el panel no sirve para instalar desde la carta (al cambiar de área se descarta)', async () => {
    window.history.pushState({}, '', '/admin/pedidos');
    vi.resetModules();
    const pwa = await import('../instalar');
    pwa.iniciarCapturaInstalar();
    const evento = dispararInstalable();
    expect(pwa.appDelAvisoNativo()).toBe('admin');
    window.history.pushState({}, '', '/');
    expect(pwa.tieneAvisoNativo()).toBe(false);
    expect(await pwa.instalar()).toBe('no-disponible');
    expect(evento.prompt).not.toHaveBeenCalled();
  });

  it('ya instalada: dice «Ya instalada» y «Reinstalar / actualizar» explica cómo sobrescribir y busca la actualización', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const update = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: vi.fn().mockResolvedValue({ update, waiting: null, installing: null }) },
      configurable: true,
    });
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp siempre />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    await act(async () => {});

    expect(tarjeta('carta').getByText('Ya instalada')).toBeDefined();
    fireEvent.click(tarjeta('carta').getByRole('button', { name: 'Reinstalar / actualizar' }));
    await act(async () => {});
    expect(tarjeta('carta').getByText(/Para sobrescribirla/)).toBeDefined();
    expect(update).toHaveBeenCalled();
    expect(screen.getByText('Ya tienes lo último.')).toBeDefined();
  });

  it('«Buscar actualización» está a la vista', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    expect(screen.getByRole('button', { name: 'Buscar actualización' })).toBeDefined();
  });

  it('en iPhone, «Instalar» de la app activa muestra los pasos con Compartir y la nota de Safari', async () => {
    ponerUserAgent(UA_IPHONE);
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    fireEvent.click(tarjeta('carta').getByRole('button', { name: 'Instalar' }));

    expect(screen.getByText(/Compartir/)).toBeDefined();
    expect(screen.getByText(/Añadir a pantalla de inicio/)).toBeDefined();
    expect(screen.getByText(/Abre esta página en Safari/)).toBeDefined();
  });

  it('sin prompt (Android/escritorio) «Instalar» muestra los pasos manuales y la nota de WhatsApp', async () => {
    const { BotonInstalarApp } = await cargarBoton();
    render(<BotonInstalarApp />);
    fireEvent.click(screen.getByRole('button', { name: NOMBRE_BOTON }));
    fireEvent.click(tarjeta('carta').getByRole('button', { name: 'Instalar' }));

    expect(screen.getByText(/Abre el menú/)).toBeDefined();
    expect(screen.getByText(/Si usas el navegador dentro de WhatsApp o Facebook, ábrelo en Chrome/)).toBeDefined();
  });

  it('abierta con ?instalar=admin (AutoInstalar) abre sola la ventana con esa tarjeta marcada', async () => {
    window.history.pushState({}, '', '/admin/?instalar=admin');
    vi.resetModules();
    const pwa = await import('../instalar');
    pwa.iniciarCapturaInstalar();
    const { AutoInstalar } = await import('../AutoInstalar');
    render(<AutoInstalar />);
    expect(screen.getByRole('dialog', { name: TITULO_ADMIN })).toBeDefined();
    expect(document.body.querySelector('[data-app="admin"]')?.getAttribute('style')).toContain('2px solid');
    // si el aviso llega, se intenta abrir solo; sin toque del usuario el navegador lo rechaza y el botón sigue sirviendo
    const evento = dispararInstalable();
    await act(async () => {});
    expect(evento.prompt).toHaveBeenCalled();
    window.history.pushState({}, '', '/');
  });

  it('?instalar=admin en la carta pública se ignora: sigue siendo la app de la carta', async () => {
    window.history.pushState({}, '', '/?instalar=admin');
    vi.resetModules();
    const pwa = await import('../instalar');
    pwa.iniciarCapturaInstalar();
    expect(pwa.appSolicitada()).toBeNull();
    const { AutoInstalar } = await import('../AutoInstalar');
    const { container } = render(<AutoInstalar />);
    expect(container).toBeEmptyDOMElement();
    window.history.pushState({}, '', '/');
  });
});
