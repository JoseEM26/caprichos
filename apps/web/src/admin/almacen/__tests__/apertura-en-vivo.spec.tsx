import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Socket falso: una sola instancia compartida con el módulo real de socket.
const manejadores: Record<string, Array<(...a: any[]) => void>> = {};
const falso = {
  connected: true,
  on: (e: string, f: any) => ((manejadores[e] ||= []).push(f), falso),
  off: (e: string, f: any) => { manejadores[e] = (manejadores[e] || []).filter((x) => x !== f); return falso; },
  connect: vi.fn(), disconnect: vi.fn(() => falso),
};
vi.mock('socket.io-client', () => ({ io: () => falso }));
const emitir = (e: string) => (manejadores[e] || []).slice().forEach((f) => f());

import { AperturaDiaView } from '../AperturaDiaView';
import { almacenApi } from '../almacenApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

const producto = (saldo: number, quedaron = saldo) => ({
  productoId: 'p1', nombre: 'BROWNIE', areaNombre: 'Cocina', saldo, quedaronAyer: quedaron, producidoHoy: 0,
  aperturaHoy: true, aperturaCantidad: quedaron,
});
const otro = (saldo: number) => ({ ...producto(saldo), productoId: 'p2', nombre: 'ALFAJOR' });
const res = (...productos: any[]) => ({ fecha: '2026-11-08', productos });

const pasar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('Apertura en vivo', () => {
  let obtener: ReturnType<typeof vi.spyOn>;
  let mermas: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    for (const k of Object.keys(manejadores)) delete manejadores[k];
    falso.connected = true;
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
    obtener = vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue(res(producto(10), otro(5)) as any);
    mermas = vi.spyOn(almacenApi, 'mermasHoy').mockResolvedValue({ fecha: '2026-11-08', mermas: [] });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const abrir = async () => {
    render(<AperturaDiaView />);
    await pasar(0);
    expect(screen.getByText('BROWNIE')).toBeInTheDocument();
  };

  it('stock:cambio recarga una sola vez aunque lleguen varios seguidos (antirrebote) y refresca el saldo y las mermas', async () => {
    await abrir();
    expect(obtener).toHaveBeenCalledTimes(1);
    obtener.mockResolvedValue(res(producto(7), otro(5)) as any);
    act(() => { emitir('stock:cambio'); emitir('stock:cambio'); emitir('stock:cambio'); });
    await pasar(500);
    expect(obtener).toHaveBeenCalledTimes(1);
    await pasar(400);
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(mermas).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Saldo actual: 7')).toBeInTheDocument();
    expect(screen.getByTestId('indicador-en-vivo')).toHaveTextContent(/En vivo · actualizado \d{2}:\d{2}/);
  });

  it('sin evento no recarga', async () => {
    await abrir();
    await pasar(30_000);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it('respaldo cada 60 s solo con la pestaña visible', async () => {
    await abrir();
    const vis = vi.spyOn(document, 'visibilityState', 'get');
    vis.mockReturnValue('hidden');
    await pasar(60_000);
    expect(obtener).toHaveBeenCalledTimes(1);
    vis.mockReturnValue('visible');
    await pasar(60_000);
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it('conserva lo que se está escribiendo y marca la fila si el stock cambió mientras contaba', async () => {
    await abrir();
    const campo = screen.getByLabelText('Quedaron de ayer BROWNIE');
    fireEvent.change(campo, { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Quedaron de ayer ALFAJOR'), { target: { value: '5' } });
    obtener.mockResolvedValue(res(producto(8, 8), otro(5)) as any);
    act(() => emitir('stock:cambio'));
    await pasar(900);
    expect(screen.getByLabelText('Quedaron de ayer BROWNIE')).toHaveValue(4);
    expect(screen.getByTestId('aviso-cambio')).toHaveTextContent('Cambió el stock mientras contabas: ahora 8');
    expect(screen.getAllByTestId('aviso-cambio')).toHaveLength(1); // ALFAJOR no cambió
  });

  it('una fila que no se tocó se actualiza sola y no lleva aviso', async () => {
    await abrir();
    obtener.mockResolvedValue(res(producto(7, 7), otro(5)) as any);
    act(() => emitir('stock:cambio'));
    await pasar(900);
    expect(screen.getByLabelText('Quedaron de ayer BROWNIE')).toHaveValue(7);
    expect(screen.queryByTestId('aviso-cambio')).not.toBeInTheDocument();
  });

  it('al guardar la merma tras un cambio externo manda el saldo contra el que contó; si la API dice CONTEO_DESACTUALIZADO recarga y avisa', async () => {
    await abrir();
    fireEvent.change(screen.getByLabelText('Quedaron de ayer BROWNIE'), { target: { value: '4' } });
    obtener.mockResolvedValue(res(producto(8, 10), otro(5)) as any);
    act(() => emitir('stock:cambio'));
    await pasar(900);
    const registrar = vi.spyOn(almacenApi, 'registrarApertura').mockRejectedValue(
      new ErrorApi('CONTEO_DESACTUALIZADO', 'El stock cambió mientras contabas. Recarga la pantalla.', 409),
    );
    fireEvent.click(screen.getByRole('button', { name: /Guardar apertura/ }));
    await pasar(0);
    fireEvent.change(screen.getByLabelText('Mismo motivo para todos'), { target: { value: 'ERROR_COCINA' } });
    obtener.mockResolvedValue(res(producto(8, 8), otro(5)) as any);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar merma y guardar' }));
    await pasar(0);
    expect(registrar).toHaveBeenCalledWith([
      expect.objectContaining({ productoId: 'p1', cantidad: 4, saldoEsperado: 10, motivo: 'ERROR_COCINA' }),
    ]);
    expect(screen.getByText(/El stock cambió mientras contabas/)).toBeInTheDocument();
    expect(screen.getByLabelText('Quedaron de ayer BROWNIE')).toHaveValue(8); // recuento limpio
    expect(screen.queryByTestId('aviso-cambio')).not.toBeInTheDocument();
  });

  it('el indicador avisa «Reconectando…» si el socket cae', async () => {
    await abrir();
    falso.connected = false;
    act(() => emitir('disconnect'));
    expect(screen.getByTestId('indicador-en-vivo')).toHaveTextContent('Reconectando…');
    falso.connected = true;
    act(() => emitir('connect'));
    await pasar(900);
    expect(screen.getByTestId('indicador-en-vivo')).toHaveTextContent('En vivo');
    expect(obtener).toHaveBeenCalledTimes(2); // al reconectar recarga
  });

  it('al desmontar quita los oyentes y el intervalo', async () => {
    const { unmount } = render(<AperturaDiaView />);
    await pasar(0);
    unmount();
    expect((manejadores['stock:cambio'] || []).length).toBe(0);
    const n = obtener.mock.calls.length;
    emitir('stock:cambio');
    await pasar(120_000);
    expect(obtener.mock.calls.length).toBe(n);
  });
});
