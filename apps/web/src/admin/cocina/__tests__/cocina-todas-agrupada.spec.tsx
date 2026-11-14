import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { CocinaAdminView } from '../CocinaAdminView';
import { agruparPorCuenta } from '../cuentaExtras';
import type { Comanda, LineaComanda } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({ reproducirCampanaCocina: vi.fn(), estaSilenciado: vi.fn().mockReturnValue(false), setSilenciado: vi.fn() }));
vi.mock('react-router-dom', async () => ({ ...(await vi.importActual<any>('react-router-dom')), useNavigate: () => vi.fn() }));

const lin = (id: string, nombre: string): LineaComanda => ({ id, nombre, cantidad: 1, listas: 1, despachadas: 0, opciones: [], personas: [], nota: null });
const com = (pedidoId: string, codigo: string, nombre: string, over: Partial<Comanda> = {}): Comanda => ({
  id: `${pedidoId}-1`,
  pedidoId,
  areaId: '1',
  areaNombre: 'Barra',
  ticket: codigo,
  codigo,
  canal: 'WEB',
  modalidad: 'MESA',
  cliente: 'Ana',
  mesa: '4',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date(Date.now() - (10 - Number(pedidoId)) * 60000).toISOString(),
  lineas: [lin(`l${pedidoId}`, nombre)],
  areas: [{ areaId: '1', areaNombre: 'Barra', despejada: false, lineas: [lin(`l${pedidoId}`, nombre)] }],
  despejada: false,
  ...over,
});
const ext = (id: string, codigo: string, nombre: string) => com(id, codigo, nombre, { pedidoOrigenId: '1', extraDe: 'CP-001' });

describe('Cocina «Todas»: original + extras en una tarjeta', () => {
  let eventos: Record<string, () => void>;
  beforeEach(() => {
    vi.clearAllMocks();
    eventos = {};
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: () => void) => {
      eventos[ev] = fn;
    }) as any);
    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation((() => {}) as any);
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
      usuario: { partyId: '1', nombres: 'Test', rol: 'COCINERO' },
      permisos: [],
      debeCambiar: false,
      cargando: false,
      autenticado: true,
      ingresar: vi.fn(),
      salir: vi.fn(),
      renovar: vi.fn(),
      refrescarYo: vi.fn(),
      marcarClaveCambiada: vi.fn(),
      tiene: vi.fn().mockReturnValue(true),
    } as any);
    vi.spyOn(cocinaApi, 'listarAreasCocina').mockResolvedValue([{ id: '1', nombre: 'Barra', comandasPendientes: 1 }]);
    vi.spyOn(cocinaApi, 'obtenerAltaDemanda').mockResolvedValue({ activa: false, minutos: 0, pausa: false });
  });

  const abrirTodas = async () => {
    render(<CocinaAdminView />);
    await waitFor(() => expect(screen.getAllByTestId(/^comanda-CP-/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /^Área: / }));
    fireEvent.click(screen.getByRole('option', { name: 'Todas' }));
  };

  it('agruparPorCuenta: sin extras un grupo por pedido; extras al original', () => {
    expect(agruparPorCuenta([com('1', 'A', 'x'), com('2', 'B', 'y')]).map((g) => g.partes.length)).toEqual([1, 1]);
    const g = agruparPorCuenta([ext('3', 'C', 'z'), com('1', 'A', 'x'), ext('2', 'B', 'y')]);
    expect(g).toHaveLength(1);
    expect(g[0].partes.map((p) => p.codigo)).toEqual(['A', 'B', 'C']);
  });

  it('original y 2 extras: una sola tarjeta con cabecera única y secciones', async () => {
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([com('1', 'CP-001', 'Waffle'), ext('2', 'CP-002', 'Latte'), ext('3', 'CP-003', 'Dona')]);
    await abrirTodas();
    const c = await screen.findByTestId('cuenta-1');
    expect(screen.getAllByTestId(/^cuenta-\d/)).toHaveLength(1);
    expect(within(c).getByTestId('cuenta-extras')).toHaveTextContent('+ 2 extras');
    expect(within(c).getAllByTestId('comanda-etiqueta-parte').map((e) => e.textContent)).toEqual(['Pedido original', 'Extra 1', 'Extra 2']);
    expect(within(c).getByText('Latte')).toBeInTheDocument();
    expect(within(c).getAllByTestId('cuenta-codigo')).toHaveLength(1);
    expect(within(c).queryAllByTestId('comanda-cliente')).toHaveLength(0);
  });

  it('despachar una línea de un extra llama a la API con el pedido del extra', async () => {
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([com('1', 'CP-001', 'Waffle'), ext('2', 'CP-002', 'Latte')]);
    const d = vi.spyOn(cocinaApi, 'despacharPedido').mockResolvedValue({} as any);
    await abrirTodas();
    fireEvent.click(await screen.findByRole('button', { name: 'Despachar 1 de Latte' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Sí/ }));
    await waitFor(() => expect(d).toHaveBeenCalledWith('2', [{ lineaId: 'l2', unidades: 1 }]));
  });

  it('un extra por socket se une a la tarjeta sin duplicarse', async () => {
    const l = vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([com('1', 'CP-001', 'Waffle')]);
    await abrirTodas();
    await waitFor(() => expect(screen.getAllByTestId('comanda-CP-001')).toHaveLength(1));
    expect(screen.queryByTestId('cuenta-1')).toBeNull();
    l.mockResolvedValue([com('1', 'CP-001', 'Waffle'), ext('2', 'CP-002', 'Latte')]);
    await act(async () => eventos['pedido:nuevo']());
    await screen.findByTestId('cuenta-1');
    expect(screen.getAllByTestId('comanda-CP-001')).toHaveLength(1);
    expect(screen.getAllByTestId('comanda-CP-002')).toHaveLength(1);
  });

  it('pedidos sin extras: tarjetas sueltas como antes', async () => {
    vi.spyOn(cocinaApi, 'listarComandasArea').mockResolvedValue([com('1', 'CP-001', 'Waffle'), com('5', 'CP-005', 'Latte')]);
    await abrirTodas();
    await waitFor(() => expect(screen.getAllByTestId('comanda-cliente')).toHaveLength(2));
    expect(screen.queryByTestId('cuenta-1')).toBeNull();
  });
});
