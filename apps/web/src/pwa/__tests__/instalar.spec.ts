import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const CLAVE = 'caprichos.pwa.instalar.descartado';
const UA_ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';

type Modulo = typeof import('../instalar');

/** Carga un módulo limpio: el estado (evento diferido, listeners) vive a nivel de módulo. */
async function cargar(): Promise<Modulo> {
  vi.resetModules();
  return import('../instalar');
}

function ponerUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

/** Evento beforeinstallprompt como lo manda Chrome: con prompt() y userChoice. */
function dispararInstalable(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
  evento.prompt = vi.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(evento);
  return evento;
}

describe('instalar (PWA)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    ponerUserAgent(UA_ESCRITORIO);
    vi.restoreAllMocks();
    // jsdom no trae matchMedia: sin modo standalone por defecto
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('no ofrece nada hasta que llega el evento diferido', async () => {
    const m = await cargar();
    m.iniciarCapturaInstalar();
    // sin evento sigue ofreciendo los pasos manuales (otro equipo, aviso ya usado)
    expect(m.puedeInstalar()).toBe(true);
    expect(m.tieneAvisoNativo()).toBe(false);
  });

  it('guarda el evento diferido y lo dispara con instalar()', async () => {
    const m = await cargar();
    m.iniciarCapturaInstalar();
    const evento = dispararInstalable('accepted');

    expect(evento.defaultPrevented).toBe(true);
    expect(m.puedeInstalar()).toBe(true);
    expect(m.tieneAvisoNativo()).toBe(true);

    await expect(m.instalar()).resolves.toBe('aceptada');
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    // el evento se usa una sola vez
    expect(m.tieneAvisoNativo()).toBe(false);
    await expect(m.instalar()).resolves.toBe('no-disponible');
  });

  it('escucha beforeinstallprompt una sola vez aunque se llame varias veces', async () => {
    const m = await cargar();
    const spy = vi.spyOn(window, 'addEventListener');
    m.iniciarCapturaInstalar();
    m.iniciarCapturaInstalar();
    const llamadas = (spy.mock.calls as unknown[][]).filter((args) => args[0] === 'beforeinstallprompt');
    expect(llamadas).toHaveLength(1);
  });

  it('el descarte queda en sessionStorage: oculta el aviso en esta sesión y no en la siguiente', async () => {
    const m = await cargar();
    m.iniciarCapturaInstalar();
    dispararInstalable();
    expect(m.estaDescartado()).toBe(false);

    m.descartarInstalar();
    expect(window.sessionStorage.getItem(CLAVE)).toBe('1');
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
    expect(m.estaDescartado()).toBe(true);

    // otra carga de la app en la misma sesión de navegación sigue descartado
    const otro = await cargar();
    expect(otro.estaDescartado()).toBe(true);

    // sesión nueva (pestaña o navegador cerrado): vuelve a salir
    window.sessionStorage.clear();
    const nueva = await cargar();
    expect(nueva.estaDescartado()).toBe(false);
  });

  it('en modo standalone (ya instalada) no ofrece nada', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const m = await cargar();
    m.iniciarCapturaInstalar();
    dispararInstalable();
    expect(m.estaInstalada()).toBe(true);
    expect(m.puedeInstalar()).toBe(false);
  });

  it('tras appinstalled deja de ofrecer', async () => {
    const m = await cargar();
    m.iniciarCapturaInstalar();
    dispararInstalable();
    window.dispatchEvent(new Event('appinstalled'));
    expect(m.estaInstalada()).toBe(true);
    expect(m.puedeInstalar()).toBe(false);
  });

  it('en iPhone sin evento diferido sí hay guía que mostrar (no botón de instalar)', async () => {
    ponerUserAgent(UA_IPHONE);
    const m = await cargar();
    m.iniciarCapturaInstalar();
    expect(m.esIos()).toBe(true);
    expect(m.puedeInstalar()).toBe(true);
    expect(m.tieneAvisoNativo()).toBe(false);
    await expect(m.instalar()).resolves.toBe('no-disponible');
  });

  it('si sessionStorage lanza, no rompe: el descarte no se persiste y no hay error', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denegado');
    });
    const m = await cargar();
    m.iniciarCapturaInstalar();
    expect(() => m.estaDescartado()).not.toThrow();
    expect(m.estaDescartado()).toBe(false);
    expect(() => m.descartarInstalar()).not.toThrow();
  });
});
