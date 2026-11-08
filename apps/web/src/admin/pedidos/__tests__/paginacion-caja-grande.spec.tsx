import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { cuadriculaPorAncho } from '../paginacionCaja';
import { pedidosApi, type Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';

vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));
vi.mock('../../creditos/creditosApi', () => ({ listarPersonalActivo: vi.fn().mockResolvedValue([]), registrarConsumoCredito: vi.fn() }));
vi.mock('../../vouchers/vouchersApi', () => ({ vouchersApi: { listarVouchers: vi.fn().mockResolvedValue([]) } }));

const ahora = new Date().toISOString();
const ped = (n: number, extra: Partial<Pedido> = {}) =>
  ({
    id: String(n), codigo: `CP-${String(n).padStart(3, '0')}`, canal: 'CAJA', modalidad: 'LLEVAR', estado: 'PREPARANDO',
    pago_estado: 'PAGADO', total: 20, subtotal: 20, descuento: 0, cliente_nombre: `Cliente ${n}`, creado_en: ahora,
    lineas: [{ id: `l${n}`, nombre: 'Café', cantidad: 1, precio_unit: 20, subtotal: 20 }], ...extra,
  }) as unknown as Pedido;

const anchoOriginal = window.innerWidth;
function ancho(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
}

const manejadores: Record<string, (d: any) => void> = {};
function montar(items: Pedido[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' }, permisos: [], debeCambiar: false, cargando: false, autenticado: true, tiene: vi.fn(() => true),
  } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, cb: any) => { manejadores[ev] = cb; }) as any);
  vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
  vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) =>
    f?.pendientes ? ({ total: 0, pagina: 1, limite: 1, items: [] } as any) : ({ total: items.length, pagina: 1, limite: 100, items } as any));
  vi.spyOn(pedidosApi, 'obtenerPorId').mockImplementation(async (id: any) => items.find((p) => String(p.id) === String(id))! as any);
  vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
  return render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  ancho(anchoOriginal);
});

describe('Cuadrícula por ancho', () => {
  it.each([
    [390, 1, 6], [820, 2, 8], [1366, 4, 12], [1920, 5, 15], [2560, 7, 21],
  ])('ancho %i: %i columnas, %i por página (filas completas)', (w, cols, pag) => {
    expect(cuadriculaPorAncho(w)).toEqual({ columnas: cols, porPagina: pag });
  });
});

describe('Paginación en pantallas grandes', () => {
  it('1920: 15 por página, columnas en la cuadrícula y rango correcto', async () => {
    ancho(1920);
    montar(Array.from({ length: 40 }, (_, i) => ped(i + 1)));
    expect(await screen.findByTestId('rango-pagina')).toHaveTextContent('1–15 de 40');
    const grid = document.querySelector('.cj2-cuadricula') as HTMLElement;
    expect(grid.style.getPropertyValue('--cj2-cols')).toBe('5');
    expect(grid.children).toHaveLength(15);
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('16–30 de 40');
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('31–40 de 40');
  });

  it('con 5 o más páginas hay Primera, Última y salto directo', async () => {
    ancho(1366);
    montar(Array.from({ length: 70 }, (_, i) => ped(i + 1)));
    await screen.findByTestId('rango-pagina');
    fireEvent.click(screen.getByRole('button', { name: 'Última página' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('61–70 de 70');
    fireEvent.click(screen.getByRole('button', { name: 'Primera página' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('1–12 de 70');
    fireEvent.change(screen.getByRole('combobox', { name: 'Ir a la página' }), { target: { value: '3' } });
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('25–36 de 70');
  });

  it('menos de 5 páginas: sin Primera/Última', async () => {
    ancho(1366);
    montar(Array.from({ length: 30 }, (_, i) => ped(i + 1)));
    await screen.findByTestId('rango-pagina');
    expect(screen.queryByRole('button', { name: 'Última página' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Ir a la página' })).toBeNull();
  });

  it('un evento en tiempo real no te manda a la página 1', async () => {
    ancho(1366);
    montar(Array.from({ length: 30 }, (_, i) => ped(i + 1)));
    await screen.findByTestId('rango-pagina');
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('13–24 de 30');
    await act(async () => { manejadores['pedido:estado']?.({ id: '14', estado: 'LISTO' }); });
    await waitFor(() => expect(pedidosApi.obtenerPorId).toHaveBeenCalled());
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('13–24 de 30');
  });

  it('al agrandar la ventana la página se reajusta y el contador coincide', async () => {
    ancho(1366);
    montar(Array.from({ length: 30 }, (_, i) => ped(i + 1)));
    await screen.findByTestId('rango-pagina');
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('25–30 de 30');
    ancho(2560);
    await act(async () => { window.dispatchEvent(new Event('resize')); });
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('22–30 de 30');
  });
});

describe('Insignia de modalidad de la tarjeta', () => {
  const pintar = (p: Partial<Pedido>) =>
    render(<TarjetaPedidoCaja pedido={ped(1, p)} seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} />);

  it.each([
    [{ modalidad: 'DELIVERY' }, 'DELIVERY'],
    [{ modalidad: 'LLEVAR' }, 'PARA LLEVAR'],
    [{ modalidad: 'MESA', mesa_nombre: '4' }, 'MESA'],
    [{ modalidad: 'COMER_LOCAL' }, 'COMER EN EL LOCAL'],
  ])('%j: icono propio en círculo y texto «%s», fuera de la barra de estado', (p, texto) => {
    const { container } = pintar(p as Partial<Pedido>);
    const ins = container.querySelector('.cj2-mod-texto')!;
    expect(ins).toHaveTextContent(texto);
    expect(ins.querySelector('.cj2-mod-ico svg')).not.toBeNull();
    expect(ins.querySelector('.cj2-mod-txt')).toHaveTextContent(texto);
    expect(container.querySelector('.cj2-barra')!.contains(ins)).toBe(false);
    expect(ins.closest('.cj2-mod')).not.toBeNull();
  });

  it('el canal conserva su icono', () => {
    const { container } = pintar({ canal: 'MOZO' });
    expect(container.querySelector('.cj2-canal svg')).not.toBeNull();
  });
});
