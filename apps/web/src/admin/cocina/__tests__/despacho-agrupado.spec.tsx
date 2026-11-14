import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { DespachoView } from '../DespachoView';
import type { PedidoDespacho } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({ reproducirCampanaCocina: vi.fn(), estaSilenciado: vi.fn().mockReturnValue(false), setSilenciado: vi.fn() }));

const ped = (id: string, codigo: string, listo: boolean, over: Partial<PedidoDespacho> = {}): PedidoDespacho => ({
  pedidoId: id,
  codigo,
  modalidad: 'MESA',
  cliente: 'Ana',
  mesa: '4',
  nota: null,
  creado_en: new Date(Date.now() - (10 - Number(id)) * 60000).toISOString(),
  minutos: 10,
  direccion: null,
  referencia: null,
  telefono: null,
  areas: [{ areaId: '1', areaNombre: 'Cocina', listo, lineas: [{ id: `l${id}`, nombre: `Plato ${id}`, cantidad: 1, opciones: [], personas: [], nota: null }] }],
  completo: listo,
  estado: 'PREPARANDO',
  despachado: false,
  atendido: false,
  atendido_en: null,
  atendido_por: null,
  ...over,
});
const extra = (id: string, codigo: string, listo: boolean) => ped(id, codigo, listo, { pedidoOrigenId: '1', extraDe: 'CP-001' });
const resp = (pedidos: PedidoDespacho[]) => ({ ahoraServidor: new Date().toISOString(), umbrales: { naranjaMin: 35, rojoMin: 50 }, pedidos });

describe('Despacho agrupado: original + extras en una tarjeta', () => {
  let eventos: Record<string, () => void>;
  beforeEach(() => {
    vi.clearAllMocks();
    eventos = {};
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: () => void) => {
      eventos[ev] = fn;
    }) as any);
    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation((() => {}) as any);
  });

  it('original y 2 extras van en una sola tarjeta con secciones', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(resp([ped('1', 'CP-001', true), extra('2', 'CP-002', true), extra('3', 'CP-003', false)]));
    render(<DespachoView />);
    const t = await screen.findByTestId('pedido-despacho-1');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByTestId('etiqueta-parte-1')).toHaveTextContent('Pedido original');
    expect(screen.getByTestId('etiqueta-parte-2')).toHaveTextContent('Extra 1');
    expect(screen.getByTestId('etiqueta-parte-3')).toHaveTextContent('Extra 2');
    expect(within(t).getByTestId('grupo-cuenta-1')).toHaveTextContent('+ 2 extras');
    expect(screen.getByTestId('estado-pedido-3')).toHaveTextContent('Faltan 1 de 1');
  });

  it('despachar una parte despacha solo ese pedido', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(resp([ped('1', 'CP-001', true), extra('2', 'CP-002', false)]));
    const d = vi.spyOn(cocinaApi, 'despacharCompleto').mockResolvedValue({} as any);
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('despachar-1'));
    await waitFor(() => expect(d).toHaveBeenCalledWith('1', false));
    expect(d).toHaveBeenCalledTimes(1);
  });

  it('«Despachar todo» solo con todo listo y despacha cada parte', async () => {
    const l = vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(resp([ped('1', 'CP-001', true), extra('2', 'CP-002', false)]));
    const d = vi.spyOn(cocinaApi, 'despacharCompleto').mockResolvedValue({} as any);
    const { unmount } = render(<DespachoView />);
    expect(await screen.findByTestId('despachar-todo-1')).toBeDisabled();
    unmount();
    l.mockResolvedValue(resp([ped('1', 'CP-001', true), extra('2', 'CP-002', true)]));
    render(<DespachoView />);
    const b = await screen.findByTestId('despachar-todo-1');
    expect(b).toBeEnabled();
    fireEvent.click(b);
    await waitFor(() => expect(d).toHaveBeenCalledTimes(2));
    expect(d).toHaveBeenNthCalledWith(1, '1', false);
    expect(d).toHaveBeenNthCalledWith(2, '2', false);
  });

  it('un extra que llega por socket se une a la tarjeta del original sin duplicarse', async () => {
    const l = vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(resp([ped('1', 'CP-001', true)]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-1');
    expect(screen.queryByTestId('parte-2')).toBeNull();
    l.mockResolvedValue(resp([ped('1', 'CP-001', true), extra('2', 'CP-002', false)]));
    await act(async () => eventos['pedido:nuevo']());
    await waitFor(() => expect(screen.getByTestId('parte-2')).toBeInTheDocument());
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getAllByTestId('estado-pedido-2')).toHaveLength(1);
  });

  it('pedidos sin extras: tarjetas separadas y sin «Despachar todo»', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(resp([ped('1', 'CP-001', true), ped('5', 'CP-005', true)]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-1');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByTestId('despachar-todo-1')).toBeNull();
    expect(screen.getByTestId('despachar-1')).toHaveTextContent('Todo completo · despachar');
  });
});
