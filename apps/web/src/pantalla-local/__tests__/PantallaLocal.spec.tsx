import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import { api } from '../../comun/api';
import * as tv from '../../tv/tvApi';
import { PuertaTv } from '../../tv/PuertaTv';
import * as sesion from '../../comun/sesion';
import { PantallaLocal, Tarjeta } from '../PantallaLocal';
import { ordenar, paginar, columnasPara, textoModalidad, textoPago, estadoArea, POR_PAGINA, type PedidoPantalla } from '../logica';

const UMBRALES = { naranjaMin: 35, rojoMin: 50 };
const AHORA = new Date('2026-11-20T20:00:00.000-05:00').getTime();
const hace = (min: number) => new Date(AHORA - min * 60000).toISOString();

const ped = (o: Partial<PedidoPantalla> = {}): PedidoPantalla => ({
  codigo: 'CP-W945',
  etapa: 'COCINA',
  modalidad: 'MESA',
  mesa: 'Mesa 4',
  enEsperaMesa: false,
  nombre: 'Lucía',
  avatarUrl: null,
  zona: null,
  nota: 'Sin azúcar',
  extraDe: null,
  esperaDesde: hace(8),
  fin: null,
  minutos: 8,
  pago: { estado: 'PAGADO', medios: [{ medio: 'YAPE', monto: 30 }], total: 30, esPersonal: false },
  areas: [
    { areaId: '10', areaNombre: 'Salado', listo: true, despachada: false, lineas: [{ id: '1', nombre: 'Sándwich de pavo', cantidad: 2, tamano: 'Grande', opciones: ['Sin tomate'], personas: ['Ana'], sabores: [{ nombre: 'Fresa', cantidad: 1 }] }] },
    { areaId: '11', areaNombre: 'Bebidas', listo: false, despachada: false, lineas: [{ id: '2', nombre: 'Frappe', cantidad: 1, nota: 'poco hielo' }] },
  ],
  ...o,
});

describe('lógica de la pantalla', () => {
  it('ordena lo que espera (el más antiguo primero), luego anulados y listos', () => {
    const r = ordenar([
      ped({ codigo: 'L', etapa: 'LISTO', esperaDesde: hace(30) }),
      ped({ codigo: 'N', esperaDesde: hace(2) }),
      ped({ codigo: 'A', etapa: 'ANULADO', esperaDesde: hace(40) }),
      ped({ codigo: 'V', esperaDesde: hace(20) }),
    ]);
    expect(r.map((p) => p.codigo)).toEqual(['V', 'N', 'A', 'L']);
  });

  it('pagina y ajusta las columnas a la cantidad', () => {
    expect(paginar([1, 2, 3, 4, 5, 6, 7], POR_PAGINA).map((x) => x.length)).toEqual([6, 1]);
    expect(paginar([])).toEqual([[]]);
    expect([1, 3, 5, 6].map(columnasPara)).toEqual([1, 2, 3, 3]);
  });

  it('textos de modalidad y de pago', () => {
    expect(textoModalidad(ped())).toBe('Mesa 4');
    expect(textoModalidad(ped({ modalidad: 'COMER_LOCAL', mesa: null }))).toBe('Comer en el local');
    expect(textoModalidad(ped({ modalidad: 'LLEVAR' }))).toBe('Para llevar');
    expect(textoModalidad(ped({ modalidad: 'RECOGER' }))).toBe('Recoger');
    expect(textoModalidad(ped({ modalidad: 'DELIVERY', mesa: null, zona: 'MIRAFLORES' }))).toBe('DELIVERY · MIRAFLORES');
    expect(textoModalidad(ped({ enEsperaMesa: true }))).toBe('Esperando mesa');
    expect(textoPago(ped().pago)).toBe('Pagado · Yape');
    expect(textoPago({ estado: 'POR_COBRAR', medios: [], total: 5, esPersonal: false })).toBe('Por cobrar');
    expect(textoPago({ estado: 'COBRADO_MOZO', medios: [{ medio: 'EFECTIVO', monto: 5 }], total: 5, esPersonal: false })).toBe('Pagado (cobró el mozo) · Efectivo');
  });

  it('estado por área: lista, preparando o en espera si aún está en caja', () => {
    const a = ped().areas;
    expect(estadoArea(a[0], 'COCINA')).toMatchObject({ listo: true, texto: 'Lista' });
    expect(estadoArea(a[1], 'COCINA')).toMatchObject({ listo: false, texto: 'Preparando' });
    expect(estadoArea(a[1], 'CAJA').texto).toBe('En espera');
  });
});

describe('Tarjeta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });
  afterEach(() => vi.useRealTimers());

  it('muestra toda la información: código, quién, modalidad, productos con detalle, nota, pago, etapa y áreas', () => {
    render(<Tarjeta p={ped()} umbrales={UMBRALES} />);
    const t = screen.getByTestId('pedido-CP-W945');
    expect(within(t).getByTestId('codigo')).toHaveTextContent('CP-W945');
    expect(within(t).getByTestId('nombre')).toHaveTextContent('Lucía');
    expect(within(t).getByTestId('modalidad')).toHaveTextContent('Mesa 4');
    expect(t).toHaveTextContent('2×');
    expect(t).toHaveTextContent('Sándwich de pavo');
    expect(t).toHaveTextContent('Grande · Sin tomate · Para Ana · 1 Fresa');
    expect(t).toHaveTextContent('Nota: poco hielo');
    expect(within(t).getByTestId('nota')).toHaveTextContent('Sin azúcar');
    expect(within(t).getByTestId('pago')).toHaveTextContent('Pagado · Yape');
    expect(t).toHaveTextContent('S/ 30.00');
    expect(within(t).getByTestId('pasos').querySelector('[data-actual="true"]')).toHaveTextContent('En cocina');
    expect(within(t).getByTestId('area-10')).toHaveTextContent('Salado ✓ Lista');
    expect(within(t).getByTestId('area-11')).toHaveTextContent('Bebidas ● Preparando');
  });

  it('el tiempo transcurrido corre cada segundo y cambia de color por umbral', () => {
    render(<Tarjeta p={ped({ esperaDesde: hace(34) })} umbrales={UMBRALES} />);
    const tiempo = screen.getByTestId('tiempo');
    expect(tiempo).toHaveTextContent('34:00');
    expect(tiempo).toHaveAttribute('data-color', 'VERDE');
    act(() => {
      vi.advanceTimersByTime(61000);
    });
    expect(screen.getByTestId('tiempo')).toHaveTextContent('35:01');
    expect(screen.getByTestId('tiempo')).toHaveAttribute('data-color', 'NARANJA');
    act(() => {
      vi.advanceTimersByTime(15 * 60000);
    });
    expect(screen.getByTestId('tiempo')).toHaveAttribute('data-color', 'ROJO');
  });

  it('un pedido listo deja detenido lo que esperó y va en verde', () => {
    render(<Tarjeta p={ped({ etapa: 'LISTO', esperaDesde: hace(10), fin: hace(4) })} umbrales={UMBRALES} />);
    expect(screen.getByTestId('tiempo')).toHaveTextContent('Esperó6:00');
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(screen.getByTestId('tiempo')).toHaveTextContent('6:00');
    expect(screen.getByTestId('tiempo')).toHaveAttribute('data-color', 'VERDE');
  });

  it('anulado se marca con el sello y en rojo', () => {
    render(<Tarjeta p={ped({ etapa: 'ANULADO', fin: hace(1) })} umbrales={UMBRALES} />);
    expect(screen.getByTestId('sello-anulado')).toHaveTextContent('ANULADO');
    expect(screen.getByTestId('pedido-CP-W945')).toHaveAttribute('data-etapa', 'ANULADO');
    expect(screen.getByTestId('tiempo')).toHaveAttribute('data-color', 'ROJO');
  });

  it('delivery se muestra con su zona y sin nombre cuando el servidor no lo manda', () => {
    render(<Tarjeta p={ped({ modalidad: 'DELIVERY', mesa: null, zona: 'SURCO', nombre: null })} umbrales={UMBRALES} />);
    expect(screen.getByTestId('modalidad')).toHaveTextContent('DELIVERY · SURCO');
    expect(screen.queryByText('Lucía')).toBeNull();
  });
});

describe('PantallaLocal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const avanzar = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  const resp = (pedidos: PedidoPantalla[]) => ({ pedidos, mostrarNombre: true, umbrales: UMBRALES, ahora: new Date().toISOString() });

  it('no dibuja a Capri ni usa su mascota: solo pedidos y el reloj', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(resp([ped()]));
    render(<PantallaLocal />);
    await avanzar(10);
    expect(screen.getByTestId('pedido-CP-W945')).toBeInTheDocument();
    expect(screen.queryByTestId('capri')).toBeNull();
    expect(screen.queryByLabelText(/Capri/i)).toBeNull();
    expect(screen.getByLabelText('Hora de Lima')).toBeInTheDocument();
  });

  it('con sesión lee el endpoint autenticado; con llave de TV usa /carta/tv/pedidos-local con la llave', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(resp([]));
    const fetchTv = vi.spyOn(tv, 'tvFetch').mockResolvedValue(resp([ped()]));
    const { unmount } = render(<PantallaLocal />);
    await avanzar(10);
    expect(get).toHaveBeenCalledWith('/admin/pantalla-local/pedidos');
    expect(fetchTv).not.toHaveBeenCalled();
    unmount();
    render(<PantallaLocal acceso={{ llave: 'LLAVE-X', areaId: null, revocada: () => undefined }} />);
    await avanzar(10);
    expect(fetchTv).toHaveBeenCalledWith('/carta/tv/pedidos-local', 'LLAVE-X');
    expect(screen.getByTestId('pedido-CP-W945')).toBeInTheDocument();
  });

  it('con más pedidos de los que caben pasa de página solo', async () => {
    const muchos = Array.from({ length: 8 }, (_, i) => ped({ codigo: `CP-${i}`, esperaDesde: hace(30 - i) }));
    vi.spyOn(api, 'get').mockResolvedValue(resp(muchos));
    render(<PantallaLocal />);
    await avanzar(10);
    expect(screen.getByTestId('paginas')).toHaveTextContent('Página 1 de 2');
    expect(screen.getByTestId('pedido-CP-0')).toBeInTheDocument();
    expect(screen.queryByTestId('pedido-CP-7')).toBeNull();
    await avanzar(12100);
    expect(screen.getByTestId('paginas')).toHaveTextContent('Página 2 de 2');
    expect(screen.getByTestId('pedido-CP-7')).toBeInTheDocument();
  });

  it('un pedido que desaparece de la lista se quita, y sin pedidos lo dice', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce(resp([ped()]));
    render(<PantallaLocal />);
    await avanzar(10);
    get.mockResolvedValue(resp([]));
    await avanzar(5000);
    expect(screen.queryByTestId('pedido-CP-W945')).toBeNull();
    expect(screen.getByTestId('sin-pedidos')).toBeInTheDocument();
  });

  it('si la API falla avisa sin conexión y conserva lo último', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValueOnce(resp([ped()]));
    render(<PantallaLocal />);
    await avanzar(10);
    get.mockRejectedValue(new Error('red'));
    await avanzar(5000);
    expect(screen.getByText('Sin conexión, reintentando')).toBeInTheDocument();
    expect(screen.getByTestId('pedido-CP-W945')).toBeInTheDocument();
  });
});

describe('protección por código de vinculación', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.spyOn(sesion, 'useSesion').mockReturnValue({ usuario: null, cargando: false, tiene: () => false } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sin sesión ni llave la TV muestra el código y NO pide ningún dato de pedidos', async () => {
    vi.spyOn(tv.tvApi, 'pedirCodigo').mockResolvedValue({ codigo: 'ABC234', llave: 'LL', expiraEn: new Date(Date.now() + 600000).toISOString() });
    vi.spyOn(tv.tvApi, 'estado').mockResolvedValue({ vinculada: false, activa: false } as any);
    const get = vi.spyOn(api, 'get');
    const fetchTv = vi.spyOn(tv, 'tvFetch');
    render(
      <PuertaTv vista="PANTALLA_LOCAL" permiso="cocina/ver">
        {(a) => <PantallaLocal acceso={a} />}
      </PuertaTv>,
    );
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByLabelText('Código de vinculación')).toHaveTextContent('ABC-234');
    expect(tv.tvApi.pedirCodigo).toHaveBeenCalledWith('PANTALLA_LOCAL');
    expect(window.localStorage.getItem('caprichos_tv_llave_PANTALLA_LOCAL')).toBe('LL');
    expect(get).not.toHaveBeenCalled();
    expect(fetchTv).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pantalla-local')).toBeNull();
  });
});
