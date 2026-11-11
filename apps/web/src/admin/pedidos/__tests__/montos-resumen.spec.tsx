import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi, type Pedido } from '../pedidosApi';
import { resumirDia, filasDePedidos } from '../resumenDia';
import { totalesCuenta } from '../TarjetaCuentaCaja';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';
import { impresionApi } from '../../impresion/impresionApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { abrirFiltros } from './abrirFiltros';

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

// Datos inventados: 2 pagados vivos (20+30), 2 por cobrar (10+40), 1 entregado pagado (25), 1 anulado (99)
const dia = () => [
  ped(1, { total: 20 }),
  ped(2, { total: 30, modalidad: 'DELIVERY' }),
  ped(3, { total: 10, pago_estado: 'PENDIENTE', estado: 'COLA' }),
  ped(4, { total: 40, pago_estado: 'PENDIENTE', estado: 'COLA', modalidad: 'DELIVERY' }),
  ped(5, { total: 25, estado: 'ENTREGADO' }),
  ped(6, { total: 99, estado: 'ANULADO' }),
];

const manejadores: Record<string, Array<(d: any) => void>> = {};
function montar(lista: () => Pedido[], resumenApi?: () => any[]) {
  for (const k of Object.keys(manejadores)) delete manejadores[k];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1', nombres: 'A', rol: 'ADMIN' }, permisos: [], debeCambiar: false, cargando: false, autenticado: true, tiene: vi.fn(() => true) } as any);
  vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: (d: any) => void) => { (manejadores[ev] ??= []).push(fn); }) as any);
  vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
  vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
  vi.spyOn(pedidosApi, 'obtenerPorId').mockImplementation(async (id: any) => lista().find((p) => String(p.id) === String(id))!);
  const listar = vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) => {
    if (f?.pendientes) return { total: 0, pagina: 1, limite: 1, items: [] } as any;
    const items = lista();
    return { total: items.length, pagina: 1, limite: 100, items, ...(f?.resumen && resumenApi ? { resumen: resumenApi() } : {}) } as any;
  });
  vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([]);
  vi.spyOn(impresionApi, 'obtenerEstado').mockRejectedValue(new Error('sin consulta'));
  render(<MemoryRouter><PedidosAdminView /></MemoryRouter>);
  return listar;
}
const montos = async () => (await screen.findByTestId('montos-resumen')).textContent ?? '';
const emitir = async (ev: string, d: any) => { await act(async () => { (manejadores[ev] ?? []).forEach((f) => f(d)); }); };

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); window.history.pushState({}, '', '/'); });

describe('resumirDia: Ventas = Cobrado + Por cobrar', () => {
  it('separa lo cobrado de lo por cobrar y deja fuera anulados y rechazados', () => {
    const r = resumirDia(filasDePedidos(dia()));
    expect(r.ventas).toBe(125);
    expect(r.cobrado).toBe(75);
    expect(r.montoPorCobrar).toBe(50);
    expect(r.cobrado + r.montoPorCobrar).toBe(r.ventas);
    expect(r.porCobrar).toBe(2);
  });
  it('el agrupado del servidor da las mismas cifras que la lista', () => {
    const filas = [
      { estado: 'COLA', pago_estado: 'PENDIENTE', n: 2, total: 50 },
      { estado: 'ENTREGADO', pago_estado: 'PAGADO', n: 3, total: 75 },
      { estado: 'ANULADO', pago_estado: 'PAGADO', n: 1, total: 99 },
    ];
    expect(resumirDia(filas)).toMatchObject({ ventas: 125, cobrado: 75, montoPorCobrar: 50 });
  });
  it('la tarjeta de cuenta con un pedido extra usa la misma cifra por cobrar', () => {
    const t = totalesCuenta([ped(1, { total: 20 }), ped(2, { total: 15, pago_estado: 'PENDIENTE', estado: 'COLA' }), ped(3, { total: 9, estado: 'ANULADO', pago_estado: 'PENDIENTE' })]);
    expect(t).toEqual({ total: 35, porCobrar: 15 });
  });
});

describe('Montos del resumen en Caja', () => {
  it('sin filtro del día muestra las tres cifras; el contador «por cobrar» muestra la suma de esos pedidos', async () => {
    montar(dia);
    await screen.findByText('CP-003');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    let t = await montos();
    expect(t).toContain('Ventas S/ 125.00');
    expect(t).toContain('Cobrado S/ 75.00');
    expect(t).toContain('Por cobrar S/ 50.00');
    expect(t).not.toContain('Filtrado');
    fireEvent.click(within(screen.getByTestId('resumen-dia')).getByRole('button', { name: /por cobrar/ }));
    t = await montos();
    expect(t).toContain('Filtrado: 2 pedidos');
    expect(t).toContain('Ventas S/ 50.00');
    expect(t).toContain('Cobrado S/ 0.00');
    expect(t).toContain('Por cobrar S/ 50.00');
    expect(t).toContain('Día: S/ 125.00');
  });

  it('cambia con la búsqueda', async () => {
    montar(dia);
    await screen.findByText('CP-003');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'CP-004' } });
    await waitFor(async () => expect(await montos()).toContain('Filtrado: 1 pedido'));
    const t = await montos();
    expect(t).toContain('Ventas S/ 40.00');
    expect(t).toContain('Por cobrar S/ 40.00');
  });

  it('en vivo: dos eventos juntos relevan lista y resumen del servidor UNA vez (1 s) y se ve el monto nuevo', async () => {
    let lista = dia();
    let agrupado = [{ estado: 'COLA', pago_estado: 'PENDIENTE', n: 2, total: 50 }];
    const listar = montar(() => lista, () => agrupado);
    await screen.findByText('CP-003');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    expect(await montos()).toContain('Por cobrar S/ 50.00');
    lista = lista.map((p) => (p.id === '3' ? ({ ...p, pago_estado: 'PAGADO' } as Pedido) : p));
    agrupado = [{ estado: 'COLA', pago_estado: 'PENDIENTE', n: 1, total: 40 }];
    const antes = listar.mock.calls.filter((c: any) => c[0]?.resumen).length;
    vi.useFakeTimers();
    await emitir('pedido:editado', { id: '3' });
    await emitir('pedido:estado', { id: '3', estado: 'COLA' });
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    vi.useRealTimers();
    await waitFor(async () => expect(await montos()).toContain('Por cobrar S/ 40.00'));
    expect(await montos()).toContain('Cobrado S/ 85.00');
    expect(listar.mock.calls.filter((c: any) => c[0]?.resumen).length - antes).toBe(1);
  });

  it('una respuesta vieja no pisa una más nueva', async () => {
    let lista = dia();
    const listar = montar(() => lista);
    await screen.findByText('CP-003');
    abrirFiltros();
    fireEvent.click(screen.getByRole('button', { name: /Todo el día/ }));
    let soltarVieja: (v: any) => void = () => {};
    const viejo = lista;
    listar.mockImplementationOnce(() => new Promise((r) => { soltarVieja = r; }) as any);
    lista = lista.map((p) => (p.id === '3' ? ({ ...p, pago_estado: 'PAGADO' } as Pedido) : p));
    await emitir('pedido:extra', {});
    await emitir('vouchers:actualizado', {});
    await waitFor(async () => expect(await montos()).toContain('Por cobrar S/ 40.00'));
    await act(async () => { soltarVieja({ total: viejo.length, pagina: 1, limite: 100, items: viejo }); });
    expect(await montos()).toContain('Por cobrar S/ 40.00');
  });
});
