import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { culqiApi, URL_CULQI } from '../culqiApi';
import { PagarEnLinea } from '../PagarEnLinea';

const medios = ['TARJETA', 'YAPE'] as any;
const config = { activo: true, publicKey: 'pk_test_x', modo: 'REAL' as const, medios };
const intento = { intentoId: 'i1', montoCentimos: 1650, moneda: 'PEN' as const, descripcion: 'x', publicKey: 'pk_test_x', modo: 'REAL' as const, medios };

/** El script de Culqi «carga» al instante (como js.culqi.com en jsdom no descarga nada). */
function cargaOk() {
  const original = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(((el: Node) => {
    const r = original(el);
    if (el instanceof HTMLScriptElement) queueMicrotask(() => el.dispatchEvent(new Event('load')));
    return r;
  }) as any);
}

/** CulqiCheckout falso: con `conIframe` monta un iframe en el contenedor, como hace Culqi. */
function culqiFalso(conIframe: boolean, configs: any[] = []) {
  (window as any).CulqiCheckout = function (this: any, _pk: string, cfg: any) {
    configs.push(cfg);
    this.close = () => {};
    this.open = () => {
      if (conIframe) document.querySelector(cfg.options.container)?.appendChild(document.createElement('iframe'));
    };
  };
  return configs;
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete (window as any).CulqiCheckout;
  vi.spyOn(culqiApi, 'config').mockResolvedValue(config);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('Pago en línea: precarga de Culqi', () => {
  it('con pedido por pagar (modo real) el script de Culqi se pide al montar, sin esperar el clic', async () => {
    cargaOk();
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    await screen.findByText('Pagar ahora');
    expect(document.querySelector(`script[src="${URL_CULQI}"]`)).not.toBeNull();
  });
});

describe('Pago en línea: estado de carga al tocar Pagar', () => {
  it('aparece de inmediato con role status y se oculta cuando llega el iframe de Culqi', async () => {
    cargaOk();
    culqiFalso(true);
    let liberar!: () => void;
    vi.spyOn(culqiApi, 'intento').mockImplementation(() => new Promise((r) => { liberar = () => r(intento); }));
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));

    const carga = screen.getByTestId('pago-cargando');
    expect(carga.getAttribute('role')).toBe('status');
    expect(carga.getAttribute('aria-live')).toBe('polite');
    expect(carga.textContent).toMatch(/Cargando tu pago seguro…/);
    expect(carga.textContent).toMatch(/Esto puede tardar unos segundos/);

    await act(async () => liberar());
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    expect(screen.queryByTestId('pago-cargando')).toBeNull();
  });

  it('pasados 6 s pide no cerrar la ventana', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    culqiFalso(true);
    vi.spyOn(culqiApi, 'intento').mockReturnValue(new Promise(() => {}));
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    expect(screen.getByText('Esto puede tardar unos segundos')).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(6100));
    expect(screen.getByText('Sigue cargando, no cierres esta ventana')).toBeTruthy();
  });

  it('si Culqi no está disponible, el estado de carga se limpia y aparece el error con Reintentar', async () => {
    cargaOk();
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    expect((await screen.findByTestId('pago-error')).textContent).toMatch(/No se pudo abrir el pago/);
    expect(screen.queryByTestId('pago-cargando')).toBeNull();
    expect(screen.getByText('Reintentar el pago')).toBeTruthy();
  });

  it('el iframe se espera 4,5 s antes del respaldo modal, y durante el respaldo no queda carga', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cargaOk();
    const configs = culqiFalso(false);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await screen.findByTestId('culqi-embebido');
    await vi.advanceTimersByTimeAsync(4000);
    expect(configs.map((c) => c.options.modal)).toEqual([false]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(configs.map((c) => c.options.modal)).toEqual([false, true]);
    expect(screen.getByTestId('culqi-respaldo')).toBeTruthy();
    expect(screen.queryByTestId('pago-cargando')).toBeNull();
  });
});

describe('Pago en línea: cinta de tiempo', () => {
  it('con el formulario de Culqi abierto no repite el precio', async () => {
    cargaOk();
    culqiFalso(true);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('.sg-culqi iframe')).not.toBeNull());
    expect(screen.queryByTestId('falta-pagar')).toBeNull();
    const cinta = screen.getByTestId('contador-pago');
    expect(cinta.textContent).toMatch(/^Te quedan 1[45] min para pagar$/);
    expect(cinta.textContent).not.toMatch(/S\//);
    expect(cinta.getAttribute('data-urgente')).toBeNull();
  });

  it('a 3 min o menos cambia a alerta y lo dice con texto (no solo color)', async () => {
    const creadoEn = new Date(Date.now() - (13 * 60 + 30) * 1000).toISOString(); // quedan 2 min
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={creadoEn} />);
    const cinta = await screen.findByTestId('contador-pago');
    expect(cinta.textContent).toBe('Te quedan 2 min para pagar');
    expect(cinta.getAttribute('data-urgente')).toBe('si');
    expect(cinta.getAttribute('aria-label')).toBe('Te quedan 2 min para pagar');
  });

  it('al final dice que queda menos de 1 min', async () => {
    const creadoEn = new Date(Date.now() - (14 * 60 + 30) * 1000).toISOString();
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={creadoEn} />);
    expect((await screen.findByTestId('contador-pago')).textContent).toBe('Te quedan menos de 1 min');
  });

  it('sin hora del pedido no muestra cinta', async () => {
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    await screen.findByText('Pagar ahora');
    expect(screen.queryByTestId('contador-pago')).toBeNull();
  });
});
