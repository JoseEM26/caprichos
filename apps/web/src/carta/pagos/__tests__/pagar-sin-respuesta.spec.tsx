import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { culqiApi } from '../culqiApi';
import { PagarEnLinea, CintaTiempo } from '../PagarEnLinea';

const medios = ['TARJETA', 'YAPE'] as any;
const config = { activo: true, publicKey: 'pk_test_x', modo: 'REAL' as const, medios };
const intento = { intentoId: 'i1', montoCentimos: 1650, moneda: 'PEN' as const, descripcion: 'x', publicKey: 'pk_test_x', modo: 'REAL' as const, medios };
const VIGENCIA = 15 * 60 * 1000;

/** El script de Culqi «carga» al instante. */
function cargaOk() {
  const original = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(((el: Node) => {
    const r = original(el);
    if (el instanceof HTMLScriptElement) queueMicrotask(() => el.dispatchEvent(new Event('load')));
    return r;
  }) as any);
}

/** CulqiCheckout falso que guarda cada configuración. Con `conIframe` monta un iframe vacío (que nunca carga, como Culqi sin respuesta). */
function culqiFalso(conIframe: boolean) {
  const configs: any[] = [];
  (window as any).CulqiCheckout = function (this: any, _pk: string, cfg: any) {
    configs.push(cfg);
    this.close = () => {};
    this.open = () => {
      if (conIframe) document.querySelector(cfg.options.container)?.appendChild(document.createElement('iframe'));
    };
  };
  return configs;
}

/** jsdom dispara «load» en cada iframe por su cuenta, en un momento al azar: el de Culqi solo carga cuando la prueba lo dice. */
let iframeCargado = false;

beforeEach(() => {
  vi.restoreAllMocks();
  delete (window as any).CulqiCheckout;
  vi.spyOn(culqiApi, 'config').mockResolvedValue(config);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
  iframeCargado = false;
  const addOriginal = HTMLIFrameElement.prototype.addEventListener;
  vi.spyOn(HTMLIFrameElement.prototype, 'addEventListener').mockImplementation(function (this: HTMLIFrameElement, tipo: string, fn: any, opts?: any) {
    if (tipo !== 'load') return addOriginal.call(this, tipo, fn, opts);
    const { once: _una, ...resto } = typeof opts === 'object' && opts ? opts : {};
    return addOriginal.call(this, tipo, (ev: Event) => { if (iframeCargado) fn(ev); }, resto);
  } as any);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('Cinta de tiempo: la barra llena desde el primer render', () => {
  it('el primer pintado ya trae el ancho real y sin transición (no anima desde 0)', () => {
    const html = renderToStaticMarkup(<CintaTiempo restanteMs={VIGENCIA} />);
    expect(html).toMatch(/width:100%/);
    expect(html).toMatch(/transition:none/);
  });

  it('con 15 de 15 min la barra queda llena al montar', async () => {
    cargaOk();
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    await screen.findByTestId('contador-pago');
    const relleno = document.querySelector('[data-testid="contador-pago"] span[aria-hidden="true"] > span') as HTMLElement;
    expect(parseFloat(relleno.style.width)).toBeGreaterThan(99.9);
  });

  it('después del montaje solo anima los cambios posteriores', () => {
    const { container, rerender } = render(<CintaTiempo restanteMs={VIGENCIA} />);
    const relleno = () => container.querySelector('span[aria-hidden="true"] > span') as HTMLElement;
    expect(relleno().style.width).toBe('100%');
    expect(relleno().style.transition).toBe('width 30s linear');
    rerender(<CintaTiempo restanteMs={14 * 60 * 1000} />);
    expect(parseFloat(relleno().style.width)).toBeCloseTo(93.33, 1);
    expect(relleno().style.transition).toBe('width 30s linear');
  });
});

describe('Culqi sin respuesta: nunca un cuadro en blanco sin salida', () => {
  it('con iframe que no carga sigue «Cargando» y a los 10 s ofrece reintentar con código de diagnóstico', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" pedidoCodigo="CP-1234" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    expect(screen.getByTestId('pago-cargando').textContent).toMatch(/Cargando tu pago seguro…/);
    expect(screen.queryByTestId('culqi-ayuda')).toBeNull();

    await act(() => vi.advanceTimersByTimeAsync(10000));
    const ayuda = screen.getByTestId('culqi-ayuda');
    expect(ayuda.getAttribute('role')).toBe('alert');
    expect(ayuda.textContent).toMatch(/¿No carga el pago\? Prueba otra vez/);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir en ventana aparte' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar medio de pago' })).toBeTruthy();
    expect(screen.getByTestId('culqi-diagnostico').textContent).toMatch(/^Culqi sin respuesta · pedido CP-1234 · \d{2}:\d{2}:\d{2}/);
  });

  it('Reintentar vuelve a montar Culqi y quita la ayuda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    const configs = culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    await act(() => vi.advanceTimersByTimeAsync(10000));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(configs).toHaveLength(2));
    expect(configs[1].options.modal).toBe(false);
    expect(screen.queryByTestId('culqi-ayuda')).toBeNull();
    expect(screen.getByTestId('pago-cargando')).toBeTruthy();
  });

  it('Abrir en ventana aparte fuerza el respaldo modal de Culqi', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    const configs = culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    await act(() => vi.advanceTimersByTimeAsync(10000));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir en ventana aparte' }));
    await waitFor(() => expect(configs).toHaveLength(2));
    expect(configs[1].options.modal).toBe(true);
    expect(screen.getByTestId('culqi-respaldo')).toBeTruthy();
  });

  it('Cambiar medio de pago abre el cambio de medio del seguimiento', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    await act(() => vi.advanceTimersByTimeAsync(10000));
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar medio de pago' }));
    expect(await screen.findByText('Confirmar el cambio')).toBeTruthy();
    expect(screen.queryByTestId('culqi-ayuda')).toBeNull();
  });

  it('cuando el iframe termina de cargar, se quita «Cargando» y no aparece la ayuda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    iframeCargado = true;
    await act(async () => document.querySelector('.sg-culqi iframe')!.dispatchEvent(new Event('load')));
    expect(screen.queryByTestId('pago-cargando')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(screen.queryByTestId('culqi-ayuda')).toBeNull();
  });

  it('deja rastro en consola con la llave solo en prefijo y el settings sin llaves', async () => {
    cargaOk();
    culqiFalso(true);
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    const lineas = info.mock.calls.map((c) => c.map(String).join(' '));
    expect(lineas.some((l) => l.startsWith('[culqi] instancia nueva embebida llave pk_test_'))).toBe(true);
    const settings = info.mock.calls.find((c) => c[1] === 'settings enviado');
    expect(settings?.[2]).toEqual({ title: 'sí', currency: 'sí', amount: 'sí', order: 'no' });
    expect(lineas.some((l) => l.includes('pk_test_x'))).toBe(false);
  });
});
