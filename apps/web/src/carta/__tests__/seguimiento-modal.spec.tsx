import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { PantallaConfirmacion } from '../PantallaConfirmacion';
import { etapaCliente, textoPagoMedio } from '../seguimiento-textos';
import type { EstadoSeguimiento } from '../seguimiento';

const get = vi.fn();
vi.mock('../../comun/api', () => ({
  api: { get: (...a: unknown[]) => get(...a), post: vi.fn() },
  clienteFetch: vi.fn().mockResolvedValue({ whatsapp: '999888777', mediosPago: { yape: { numero: '900111222', titular: 'Local Demo' }, plin: { numero: '900333444', titular: 'Local Demo' } } }),
  ErrorApi: class ErrorApi extends Error {
    statusCode = 0;
  },
}));
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({
    pedidoConfirmado: null,
    setPedidoConfirmado: vi.fn(),
    seguimientoAbierto: { codigo: 'CP-7', token: 'tok', modalidad: 'DELIVERY', nombre: 'Ana', creadoEn: new Date().toISOString() },
    setSeguimientoAbierto: vi.fn(),
  }),
}));
vi.mock('../../pwa/BannerInstalarApp', () => ({ BannerInstalarApp: () => null }));

const paso = (clave: string, hecho: boolean, actual: boolean) => ({ clave, etiqueta: clave, hecho, actual, hora: null });
const area = (estado: 'LISTA' | 'PREPARANDO') => ({
  nombre: 'Cocina',
  estado,
  lineas: 1,
  productos: [{ nombre: 'Waffle', cantidad: 2, listas: estado === 'LISTA' ? 2 : 0, despachadas: 0 }],
});
const base = (extra: Partial<EstadoSeguimiento> = {}): EstadoSeguimiento => ({
  codigo: 'CP-7',
  estado: 'PREPARANDO',
  estadoEtiqueta: 'En preparación',
  modalidad: 'DELIVERY',
  total: 42.5,
  propina: 0,
  terminado: false,
  anulado: false,
  pasos: [paso('recibido', true, false), paso('cocina', true, true), paso('listo', false, false), paso('camino', false, false), paso('llego', false, false), paso('entregado', false, false)],
  progreso: { etapa: 'EN_COCINA', etiqueta: 'En cocina', areas: [area('PREPARANDO')], listasDe: 0, totalAreas: 1, porcentaje: 0, enCamino: false },
  detalle: { subtotal: 40, descuento: 5, envio: 7.5, puntosCanjeados: 0, nota: null, lineas: [{ nombre: 'Waffle', cantidad: 2, nota: 'Sin crema' }] },
  ...extra,
});
const pago = (medio: string, monto: number, estado: string) => ({ medio, monto, digital: medio === 'YAPE' || medio === 'PLIN', estado, actualizadoEn: null });
const dividido = (a: string, b: string, pagado = 0): Partial<EstadoSeguimiento> => ({
  pagoDigital: true,
  medioPago: 'YAPE',
  resumenPago: { pagado, total: 42.5, pagos: [pago('YAPE', 20, a) as never, pago('PLIN', 22.5, b) as never] },
});

describe('Modal de seguimiento: tres pestañas', () => {
  beforeEach(() => {
    get.mockReset();
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it('muestra Estado, Mi pedido y Pago como pestañas accesibles y recuerda la activa', async () => {
    get.mockResolvedValue(base());
    render(<PantallaConfirmacion />);
    expect(await screen.findByText('Estamos preparando tu pedido')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Estado', 'Mi pedido', 'Pago']);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(tabs[1]);
    const panel = screen.getByRole('tabpanel', { name: 'Mi pedido' });
    expect(within(panel).getByText('2 × Waffle')).toBeInTheDocument();
    expect(within(panel).getByText('Sin crema', { exact: false })).toBeInTheDocument();
    expect(within(panel).getByTestId('descuento-seguimiento')).toHaveTextContent('− S/ 5.00');
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('cambia solo, sin recargar: el voucher pasa de «sin captura» a «revisando» y marca la pestaña Pago', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get.mockResolvedValueOnce(base(dividido('SIN_VOUCHER', 'SIN_VOUCHER')));
    get.mockResolvedValue(base(dividido('EN_REVISION', 'SIN_VOUCHER')));
    render(<PantallaConfirmacion />);
    await screen.findByText('Estamos preparando tu pedido');
    expect(screen.getByRole('tab', { name: 'Pago' }).textContent).toBe('Pago');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('tab', { name: /Pago/ }).textContent).toContain('●');

    fireEvent.click(screen.getByRole('tab', { name: /Pago/ }));
    const yape = screen.getAllByTestId('pago-medio').find((x) => x.dataset.medio === 'YAPE')!;
    expect(yape).toHaveTextContent('Recibimos tu voucher y lo estamos revisando');
    expect(screen.getByRole('tab', { name: /Pago/ }).textContent).toBe('Pago');
  });

  it('no consulta con la pestaña del navegador oculta y consulta al volver', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    get.mockResolvedValue(base());
    render(<PantallaConfirmacion />);
    await screen.findByText('Estamos preparando tu pedido');
    expect(get).toHaveBeenCalledTimes(1);

    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(get).toHaveBeenCalledTimes(1);

    vis.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(get).toHaveBeenCalledTimes(2);
    vis.mockRestore();
  });

  it('pago dividido: cada medio con su monto y estado, y el resumen «Pagado S/ 20.00 de S/ 42.50»', async () => {
    get.mockResolvedValue(base(dividido('VERIFICADO', 'RECHAZADO', 20)));
    render(<PantallaConfirmacion />);
    await screen.findByText('Estamos preparando tu pedido');
    fireEvent.click(screen.getByRole('tab', { name: 'Pago' }));

    expect(screen.getByTestId('resumen-pagado')).toHaveTextContent(/Pagado\s*S\/ 20\.00 de S\/ 42\.50/);
    const [yape, plin] = screen.getAllByTestId('pago-medio');
    expect(yape).toHaveTextContent('Yape');
    expect(yape).toHaveTextContent('S/ 20.00');
    expect(yape).toHaveTextContent('Pago confirmado ✓');
    expect(plin).toHaveTextContent('Plin');
    expect(plin).toHaveTextContent('S/ 22.50');
    expect(plin).toHaveTextContent('No pudimos validar tu voucher: vuelve a enviarlo');
    // Solo se piden los datos del medio que falta
    expect(await screen.findByText('Paga con Plin')).toBeInTheDocument();
    expect(screen.queryByText('Paga con Yape')).not.toBeInTheDocument();
    expect(screen.getByText('Adjuntar captura')).toBeInTheDocument();
    expect(screen.getByText('Enviar captura por WhatsApp')).toBeInTheDocument();
  });

  it('todas las áreas listas sin el aviso LISTO: «Casi listo»; con LISTO: «Tu pedido está listo»', async () => {
    get.mockResolvedValueOnce(
      base({
        progreso: { etapa: 'EN_COCINA', etiqueta: 'Armando tu pedido para entregarlo', areas: [area('LISTA')], listasDe: 1, totalAreas: 1, porcentaje: 100, enCamino: false },
      }),
    );
    const { unmount } = render(<PantallaConfirmacion />);
    expect(await screen.findByText('Casi listo: armando tu pedido')).toBeInTheDocument();
    expect(screen.getByTestId('que-falta')).toHaveTextContent('2 de 2 productos listos');
    unmount();
    get.mockResolvedValue(
      base({
        pasos: [paso('recibido', true, false), paso('cocina', true, false), paso('listo', true, true), paso('camino', false, false), paso('llego', false, false), paso('entregado', false, false)],
        progreso: { etapa: 'EN_COCINA', etiqueta: 'Armando tu pedido para entregarlo', areas: [area('LISTA')], listasDe: 1, totalAreas: 1, porcentaje: 100, enCamino: false },
      }),
    );
    render(<PantallaConfirmacion />);
    expect(await screen.findByText('Tu pedido está listo')).toBeInTheDocument();
    expect(screen.queryByText(/Armando tu pedido/)).not.toBeInTheDocument();
    expect(screen.getByText(/Esperamos al repartidor/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Mi pedido' }));
    expect(screen.getAllByText('Listo').length).toBeGreaterThan(0);
  });

  it('pedido anulado: título claro y sin línea de tiempo', async () => {
    get.mockResolvedValue(base({ anulado: true, terminado: true, estado: 'ANULADO', pasos: [] }));
    render(<PantallaConfirmacion />);
    expect(await screen.findByText('Tu pedido fue anulado')).toBeInTheDocument();
    expect(screen.queryByLabelText('Línea de tiempo del pedido')).not.toBeInTheDocument();
  });
});

describe('etapaCliente: mensaje principal por modalidad', () => {
  const con = (modalidad: EstadoSeguimiento['modalidad'], actual: string, extra: Partial<EstadoSeguimiento> = {}) =>
    etapaCliente(base({ modalidad, pasos: [paso(actual, true, true)], ...extra }), 'Ana');

  it('delivery', () => {
    expect(con('DELIVERY', 'recibido').titulo).toBe('Recibimos tu pedido');
    expect(con('DELIVERY', 'cocina').titulo).toBe('Estamos preparando tu pedido');
    expect(con('DELIVERY', 'listo')).toMatchObject({ titulo: 'Tu pedido está listo', tono: 'listo' });
    expect(con('DELIVERY', 'camino').titulo).toBe('Tu pedido va en camino');
    expect(con('DELIVERY', 'llego').titulo).toBe('Tu repartidor llegó');
    expect(con('DELIVERY', 'entregado').titulo).toBe('Pedido entregado');
  });

  it('delivery listo con repartidor asignado', () => {
    const e = con('DELIVERY', 'listo', { progreso: { ...base().progreso!, etapa: 'LISTO', etiqueta: 'Listo, esperando salida del repartidor' } });
    expect(e.detalle).toMatch(/Ya tiene repartidor/);
  });

  it('para recoger', () => {
    expect(con('RECOGER', 'listo').titulo).toBe('Tu pedido está listo para recoger');
    expect(con('RECOGER', 'entregado').titulo).toBe('Pedido recogido');
  });

  it('comer en el local', () => {
    expect(con('COMER_LOCAL', 'listo', { ubicacion: 'ASIGNADA', mesa: 'Mesa 4' }).detalle).toBe('Te lo llevamos a la Mesa 4.');
    expect(con('COMER_LOCAL', 'listo').detalle).toBe('Te llamaremos por tu nombre, Ana.');
    expect(con('COMER_LOCAL', 'entregado').titulo).toBe('Pedido servido en tu mesa');
  });

  it('anulado y cargando', () => {
    expect(etapaCliente(base({ anulado: true })).titulo).toBe('Tu pedido fue anulado');
    expect(etapaCliente(null).clave).toBe('cargando');
  });
});

describe('textoPagoMedio: los cuatro estados del voucher', () => {
  const t = (estado: string, motivo?: string) => textoPagoMedio({ ...pago('YAPE', 10, estado), motivo } as never);
  it('refleja el estado real', () => {
    expect(t('SIN_VOUCHER')).toBe('Aún no enviaste tu captura');
    expect(t('EN_REVISION')).toBe('Recibimos tu voucher y lo estamos revisando');
    expect(t('VERIFICADO')).toBe('Pago confirmado ✓');
    expect(t('RECHAZADO')).toBe('No pudimos validar tu voucher: vuelve a enviarlo');
    expect(t('COBRADO_MOZO')).toBe('Cobrado por tu mozo');
    expect(t('AL_RECIBIR')).toBe('Lo pagas al recibir tu pedido');
  });
});

describe('Qué falta y pago verificado', () => {
  beforeEach(() => get.mockReset());
  it('muestra por área lo listo y lo que falta, con contador', async () => {
    get.mockResolvedValue(
      base({
        progreso: { etapa: 'PARCIAL', etiqueta: 'x', areas: [area('LISTA'), { nombre: 'Bebidas', estado: 'PREPARANDO', lineas: 1, productos: [{ nombre: 'Limonada', cantidad: 3, listas: 1, despachadas: 0 }] }], listasDe: 1, totalAreas: 2, porcentaje: 50, enCamino: false },
      }),
    );
    render(<PantallaConfirmacion />);
    const f = await screen.findByTestId('que-falta');
    expect(f).toHaveTextContent('3 de 5 productos listos');
    expect(f).toHaveTextContent('Falta: 2 Limonada');
  });

  it('pago verificado: sin botones de captura', async () => {
    get.mockResolvedValue(base({ pagoDigital: true, resumenPago: { pagado: 42.5, total: 42.5, pagos: [pago('YAPE', 42.5, 'VERIFICADO') as never] } }));
    render(<PantallaConfirmacion />);
    await screen.findByText('Estamos preparando tu pedido');
    fireEvent.click(screen.getByRole('tab', { name: 'Pago' }));
    expect(screen.getByTestId('pago-medio')).toHaveTextContent('Pago confirmado ✓');
    expect(screen.queryByText('Adjuntar captura')).not.toBeInTheDocument();
    expect(screen.queryByText('Enviar captura por WhatsApp')).not.toBeInTheDocument();
  });
});
