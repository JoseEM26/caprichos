import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { cabeceraSesionCarta, emitirEventoCarta, idSesionCarta, reiniciarEventosCarta, useEventoCarta } from '../eventosCarta';

function Sonda({ activo = true, visita = true }: { activo?: boolean; visita?: boolean }) {
  useEventoCarta({ activo, visita });
  return null;
}

const baliza = vi.fn((_url: string, _datos?: BodyInit | null) => true);
const cuerpos = async () => Promise.all(baliza.mock.calls.map(async (c) => JSON.parse(await (c[1] as Blob).text())));

describe('eventos de la carta (embudo anónimo)', () => {
  beforeEach(() => {
    reiniciarEventosCarta();
    baliza.mockClear();
    Object.defineProperty(navigator, 'sendBeacon', { value: baliza, configurable: true });
    Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it('emite la visita una vez por sesión, solo con código, evento, dispositivo y sesión (sin celular ni nombre)', async () => {
    const { unmount } = render(<Sonda />);
    unmount();
    render(<Sonda />); // otra vista de la misma sesión: no repite
    expect(baliza).toHaveBeenCalledTimes(1);
    expect(baliza.mock.calls[0][0]).toBe('/carta/eventos');
    const [cuerpo] = await cuerpos();
    expect(Object.keys(cuerpo).sort()).toEqual(['conSesion', 'dispositivo', 'evento', 'sesion']);
    expect(cuerpo).toMatchObject({ evento: 'VISITA', dispositivo: 'ESCRITORIO', conSesion: false });
    expect(cuerpo.sesion).toMatch(/^[A-Za-z0-9_-]{8,40}$/);
  });

  it('cada evento sale una vez por sesión y con el mismo código', async () => {
    emitirEventoCarta('CARRITO');
    emitirEventoCarta('CARRITO');
    emitirEventoCarta('CHECKOUT');
    emitirEventoCarta('PAGO');
    const todos = await cuerpos();
    expect(todos.map((c) => c.evento)).toEqual(['CARRITO', 'CHECKOUT', 'PAGO']);
    expect(new Set(todos.map((c) => c.sesion)).size).toBe(1);
  });

  it('no emite nada con «no rastrear» (DNT) ni crea el código', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<Sonda />);
    emitirEventoCarta('CARRITO');
    expect(baliza).not.toHaveBeenCalled();
    expect(idSesionCarta()).toBeNull();
    expect(cabeceraSesionCarta()).toEqual({});
    expect(sessionStorage.getItem('cp_carta_sid')).toBeNull();
  });

  it('en la vista previa del diseñador (activo=false) no emite ni liga pedidos', () => {
    render(<Sonda activo={false} />);
    emitirEventoCarta('CARRITO');
    expect(baliza).not.toHaveBeenCalled();
    expect(cabeceraSesionCarta()).toEqual({});
  });

  it('la cabecera liga el pedido con la sesión anónima', () => {
    render(<Sonda visita={false} />);
    expect(cabeceraSesionCarta()['X-Carta-Sesion']).toBe(idSesionCarta());
  });

  it('un fallo de red, de sendBeacon o del almacenamiento nunca rompe la carta', () => {
    baliza.mockImplementation(() => {
      throw new Error('beacon roto');
    });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))));
    expect(() => render(<Sonda />)).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage bloqueado');
    });
    expect(() => emitirEventoCarta('PAGO')).not.toThrow();
    expect(typeof idSesionCarta()).toBe('string'); // respaldo en memoria
    baliza.mockImplementation(() => true);
    vi.unstubAllGlobals();
  });

  it('sin sendBeacon usa fetch con keepalive y sin esperar', () => {
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
    const f = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', f);
    emitirEventoCarta('CARRITO');
    expect(f).toHaveBeenCalledWith('/carta/eventos', expect.objectContaining({ method: 'POST', keepalive: true }));
    vi.unstubAllGlobals();
  });
});
