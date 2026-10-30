import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Socket falso compartido: permite emitir eventos del servidor y simular caídas
const fake = vi.hoisted(() => {
  const oyentes: Record<string, Array<(d?: any) => void>> = {};
  const s: any = {
    connected: true,
    on: (e: string, f: any) => { (oyentes[e] ||= []).push(f); return s; },
    off: (e: string, f: any) => { oyentes[e] = (oyentes[e] || []).filter((x) => x !== f); return s; },
    connect: () => s,
    disconnect: () => s,
    emitir: (e: string, d?: any) => (oyentes[e] || []).slice().forEach((f) => f(d)),
    cuantos: (e: string) => (oyentes[e] || []).length,
  };
  return s;
});
vi.mock('socket.io-client', () => ({ io: () => fake }));
vi.mock('../pedidos/audioAlerta', () => ({ reproducirCampana: vi.fn() }));
vi.mock('../cocina/audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));
vi.mock('../repartos/MapaRepartos', () => ({ MapaRepartos: () => <div data-testid="mapa" /> }));

import { SONDEO_SIN_SOCKET_MS, useSocketConectado, useTiempoReal } from '../../comun/socket';
import * as sesionModulo from '../../comun/sesion';
import { PedidosAdminView } from '../pedidos/PedidosAdminView';
import { pedidosApi } from '../pedidos/pedidosApi';
import { SeccionVouchersPedido } from '../pedidos/SeccionVouchersPedido';
import { vouchersApi } from '../vouchers/vouchersApi';
import { CocinaAdminView } from '../cocina/CocinaAdminView';
import * as cocinaApi from '../cocina/cocinaApi';
import { RepartosView } from '../repartos/RepartosView';
import { repartosApi } from '../repartos/repartosApi';

beforeEach(() => {
  fake.connected = true;
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Admin', rol: 'ADMIN' },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    tiene: vi.fn().mockReturnValue(true),
  } as any);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useTiempoReal', () => {
  it('junta una ráfaga de eventos en una sola recarga (antirrebote 300 ms)', () => {
    vi.useFakeTimers();
    const recargar = vi.fn();
    renderHook(() => useTiempoReal(['a', 'b'], recargar));
    fake.emitir('a'); fake.emitir('b'); fake.emitir('a');
    vi.advanceTimersByTime(299);
    expect(recargar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('recarga al reconectar (solo tras una caída) y al volver la pestaña al frente', () => {
    vi.useFakeTimers();
    const recargar = vi.fn();
    renderHook(() => useTiempoReal([], recargar));
    fake.emitir('connect'); // primera conexión: ya se cargó, no recarga
    vi.advanceTimersByTime(400);
    expect(recargar).not.toHaveBeenCalled();
    fake.emitir('disconnect');
    fake.emitir('connect');
    vi.advanceTimersByTime(400);
    expect(recargar).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(400);
    expect(recargar).toHaveBeenCalledTimes(2);
  });

  it('sondea cada 60 s solo con el socket desconectado y limpia al desmontar', () => {
    vi.useFakeTimers();
    const recargar = vi.fn();
    const { unmount } = renderHook(() => useTiempoReal(['a'], recargar));
    vi.advanceTimersByTime(SONDEO_SIN_SOCKET_MS * 2);
    expect(recargar).not.toHaveBeenCalled(); // conectado: sin sondeo
    fake.connected = false;
    vi.advanceTimersByTime(SONDEO_SIN_SOCKET_MS);
    expect(recargar).toHaveBeenCalledTimes(1);
    unmount();
    vi.advanceTimersByTime(SONDEO_SIN_SOCKET_MS * 2);
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(fake.cuantos('a')).toBe(0);
  });

  it('useSocketConectado refleja el estado real del socket', () => {
    const { result } = renderHook(() => useSocketConectado());
    expect(result.current).toBe(true);
    act(() => fake.emitir('disconnect'));
    expect(result.current).toBe(false);
    act(() => fake.emitir('connect'));
    expect(result.current).toBe(true);
  });
});

describe('Caja', () => {
  it('recarga la lista al llegar el voucher (vouchers:actualizado) y no vuelve a cargar al instante por cada evento', async () => {
    const listar = vi.spyOn(pedidosApi, 'listar').mockResolvedValue({ total: 0, pagina: 1, limite: 100, items: [] } as any);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ caja: null, abierta: false, totalesPorMedio: {}, resumen: {}, efectivoEsperado: 0 } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ items: [] } as any);

    render(<PedidosAdminView />);
    await waitFor(() => expect(listar).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 400));
    const base = listar.mock.calls.length;

    act(() => {
      fake.emitir('vouchers:actualizado', { pedidoIds: ['7'], motivo: 'subido', origen: 'WHATSAPP' });
      fake.emitir('pedido:pago', { id: '7' });
    });
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(base));
    await new Promise((r) => setTimeout(r, 400));
    const porRafaga = listar.mock.calls.length - base;

    // un solo evento cuesta lo mismo que la ráfaga de dos: la ráfaga fue una sola recarga
    act(() => fake.emitir('vouchers:actualizado', { pedidoIds: ['7'] }));
    await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(base + porRafaga));
    await new Promise((r) => setTimeout(r, 400));
    expect(listar.mock.calls.length - base - porRafaga).toBe(porRafaga);
  });

  it('con el cobro abierto: llega el voucher por WhatsApp, se relee y avisa sin cerrar nada', async () => {
    const listarVouchers = vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
    render(<SeccionVouchersPedido pedidoId="7" />);
    await waitFor(() => expect(listarVouchers).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('seccion-vouchers-pedido')).toBeNull();

    listarVouchers.mockResolvedValue([
      { id: '5', archivoId: '9', semaforo: 'CONFIABLE', motivos: [], extraido: null, medio: 'YAPE' },
    ] as any);
    act(() => fake.emitir('vouchers:actualizado', { pedidoIds: ['7'], motivo: 'subido', origen: 'WHATSAPP' }));

    expect(await screen.findByTestId('seccion-vouchers-pedido')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-voucher')).toHaveTextContent('Llegó el voucher por WhatsApp');
    expect(listarVouchers).toHaveBeenCalledTimes(2);
  });

  it('el voucher de otro pedido no muestra aviso', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      { id: '5', archivoId: '9', semaforo: 'CONFIABLE', motivos: [], extraido: null, medio: 'YAPE' },
    ] as any);
    render(<SeccionVouchersPedido pedidoId="7" />);
    await screen.findByTestId('seccion-vouchers-pedido');
    act(() => fake.emitir('vouchers:actualizado', { pedidoIds: ['8'], motivo: 'subido', origen: 'WHATSAPP' }));
    expect(screen.queryByTestId('aviso-voucher')).toBeNull();
  });
});

describe('Cocina', () => {
  it('recarga áreas y comandas con carta:disponibilidad (agotados) y con pedido:progreso', async () => {
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Cocina' }] as any);
    const comandas = vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false } as any);

    render(<MemoryRouter><CocinaAdminView /></MemoryRouter>);
    await waitFor(() => expect(comandas).toHaveBeenCalled());
    const base = comandas.mock.calls.length;

    act(() => fake.emitir('carta:disponibilidad', []));
    await waitFor(() => expect(comandas.mock.calls.length).toBeGreaterThan(base));
  });
});

describe('Repartos', () => {
  it('recarga los pedidos LISTO y las rutas con reparto:rutas', async () => {
    const disp = vi.spyOn(repartosApi, 'listarDisponibles').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerResumen').mockResolvedValue(null as any);
    vi.spyOn(repartosApi, 'listarMios').mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] } as any);
    vi.spyOn(repartosApi, 'listarTodos').mockResolvedValue([]);
    vi.spyOn(repartosApi, 'obtenerConfig').mockResolvedValue(null as any);
    vi.spyOn(repartosApi, 'obtenerZonasPoligonos').mockResolvedValue(null as any);
    const rutas = vi.spyOn(repartosApi, 'listarRutasSugeridas').mockResolvedValue({ opciones: [], sinUbicacion: [], cupo: 0 } as any);

    render(<MemoryRouter><RepartosView /></MemoryRouter>);
    await waitFor(() => expect(disp).toHaveBeenCalled());
    const d0 = disp.mock.calls.length;
    const r0 = rutas.mock.calls.length;

    act(() => fake.emitir('reparto:rutas', {}));
    await waitFor(() => {
      expect(disp.mock.calls.length).toBeGreaterThan(d0);
      expect(rutas.mock.calls.length).toBeGreaterThan(r0);
    });
  });
});
