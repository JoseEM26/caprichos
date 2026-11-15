import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { culqiApi, URL_CULQI } from '../culqiApi';
import { PagarEnLinea } from '../PagarEnLinea';
import { textoPagoMedio } from '../../seguimiento-textos';

const medios = ['TARJETA', 'YAPE'] as any;
const config = { activo: true, publicKey: 'pk_test_x', modo: 'REAL' as const, medios };
const intento = { intentoId: 'i1', montoCentimos: 1650, moneda: 'PEN' as const, descripcion: 'x', publicKey: 'pk_test_x', modo: 'REAL' as const, medios };

/** Simula js.culqi.com: al cargar el script define CulqiCheckout; open() busca el contenedor como lo hace Culqi. */
function simularScriptCulqi(opts: { cargaBien: boolean }) {
  const vistoAlAbrir: { contenedorExistia?: boolean; selector?: string; nuevoLlamado?: number } = {};
  (window as any).CulqiCheckout = function (this: any, _pk: string, cfg: any) {
    vistoAlAbrir.selector = cfg.options.container;
    this.open = () => {
      vistoAlAbrir.contenedorExistia = !!document.querySelector(cfg.options.container);
      document.querySelector(cfg.options.container)?.appendChild(document.createElement('iframe'));
    };
    this.close = () => {};
  };
  const original = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(((el: Node) => {
    const r = original(el);
    if (el instanceof HTMLScriptElement && el.src === URL_CULQI) {
      queueMicrotask(() => el.dispatchEvent(new Event(opts.cargaBien ? 'load' : 'error')));
    }
    return r;
  }) as any);
  return vistoAlAbrir;
}

beforeEach(() => {
  vi.restoreAllMocks();
  delete (window as any).CulqiCheckout;
  // el script de Culqi se memoriza por módulo: cada prueba lo reimporta limpio
  vi.resetModules();
  vi.spyOn(culqiApi, 'config').mockResolvedValue(config);
  vi.spyOn(culqiApi, 'intento').mockResolvedValue(intento);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
});

describe('Culqi embebido: orden de montaje', () => {
  it('el contenedor ya está en el DOM cuando Culqi abre, y nuestro modal lo ve con altura definida', async () => {
    const visto = simularScriptCulqi({ cargaBien: true });
    const alFormulario = vi.fn();
    render(<PagarEnLinea pedidoId="p1" monto={16.5} creadoEn={new Date().toISOString()} alFormulario={alFormulario} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await waitFor(() => expect(document.querySelector('#culqi-container iframe')).not.toBeNull());
    expect(visto.contenedorExistia).toBe(true);
    expect(visto.selector).toBe('#culqi-container');
    expect(document.getElementById('culqi-container')!.className).toContain('sg-culqi');
    expect(alFormulario).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('falta-pagar').textContent).toMatch(/^Pagar S\/ 16\.50 · Te quedan 1[45] min$/);
  });
});

describe('Culqi embebido: errores visibles, no un hueco', () => {
  it('si el script de Culqi no carga, muestra «No se pudo abrir el pago» y deja reintentar', async () => {
    simularScriptCulqi({ cargaBien: false });
    // el script se memoriza por módulo: módulo nuevo = sin la carga exitosa de la prueba anterior
    const api = await import('../culqiApi');
    vi.spyOn(api.culqiApi, 'config').mockResolvedValue(config);
    vi.spyOn(api.culqiApi, 'intento').mockResolvedValue(intento);
    const { PagarEnLinea } = await import('../PagarEnLinea');
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    expect((await screen.findByTestId('pago-error')).textContent).toMatch(/No se pudo abrir el pago/);
    expect(screen.getByText('Reintentar el pago')).toBeTruthy();
  });
  it('si Culqi no llega a montar su iframe, avisa en vez de dejar el contenedor vacío', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (window as any).CulqiCheckout = function (this: any) { this.open = () => {}; this.close = () => {}; };
    const original = document.head.appendChild.bind(document.head);
    vi.spyOn(document.head, 'appendChild').mockImplementation(((el: Node) => {
      const r = original(el);
      if (el instanceof HTMLScriptElement) queueMicrotask(() => el.dispatchEvent(new Event('load')));
      return r;
    }) as any);
    render(<PagarEnLinea pedidoId="p1" monto={16.5} />);
    fireEvent.click(await screen.findByText('Pagar ahora'));
    await screen.findByTestId('culqi-embebido');
    await vi.advanceTimersByTimeAsync(10500);
    expect((await screen.findByTestId('pago-error')).textContent).toMatch(/No se pudo abrir el pago/);
    vi.useRealTimers();
  });
});

describe('Resumen: medio CULQI', () => {
  const p = (estado: string) => ({ medio: 'CULQI', monto: 16.5, digital: false, estado, actualizadoEn: null }) as never;
  it('dice pago en línea y Falta pagar / Pagado, nunca «lo pagas al recibir»', () => {
    expect(textoPagoMedio(p('AL_RECIBIR'))).toBe('Pago en línea con tarjeta o Yape · Falta pagar');
    expect(textoPagoMedio(p('SIN_VOUCHER'))).toBe('Pago en línea con tarjeta o Yape · Falta pagar');
    expect(textoPagoMedio(p('PAGADO'))).toBe('Pago en línea con tarjeta o Yape · Pagado ✓');
    expect(textoPagoMedio(p('AL_RECIBIR'))).not.toMatch(/recibir/);
  });
});
