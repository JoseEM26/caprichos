import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { PedidosAdminView } from '../PedidosAdminView';
import { pedidosApi } from '../pedidosApi';
import { ordenInicial, ordenarPorTiempo, recordarOrden } from '../ordenCaja';
import * as sesionModulo from '../../../comun/sesion';
import * as socketModulo from '../../../comun/socket';

vi.mock('../audioAlerta', () => ({ reproducirCampana: vi.fn() }));

const ped = (id: string, codigo: string, creado_en: string, estado = 'COLA') =>
  ({ id, codigo, canal: 'CARTA', modalidad: 'LLEVAR', estado, pago_estado: 'PENDIENTE', total: 10, cliente_nombre: `Cli ${codigo}`, creado_en, lineas: [] }) as any;

// Orden del servidor: creado_en descendente (el más nuevo primero)
const DEL_SERVIDOR = [
  ped('4', 'CP-D', '2026-10-28T20:00:00Z'),
  ped('3', 'CP-C', '2026-10-28T19:00:00Z'),
  ped('2', 'CP-B', '2026-10-28T18:00:00Z'),
  ped('1', 'CP-A', '2026-10-28T18:00:00Z'), // empata con CP-B
];

const codigos = () => screen.getAllByLabelText(/^Pedido CP-/).map((e) => /CP-\w/.exec(e.getAttribute('aria-label')!)![0]);

describe('ordenarPorTiempo', () => {
  it('«menos» deja el orden del servidor y «mas» invierte por creado_en con empate por código', () => {
    expect(ordenarPorTiempo(DEL_SERVIDOR, 'menos').map((p) => p.codigo)).toEqual(['CP-D', 'CP-C', 'CP-B', 'CP-A']);
    expect(ordenarPorTiempo(DEL_SERVIDOR, 'mas').map((p) => p.codigo)).toEqual(['CP-A', 'CP-B', 'CP-C', 'CP-D']);
  });
  it('no muta la lista y tolera pedidos sin creado_en', () => {
    const copia = [...DEL_SERVIDOR];
    ordenarPorTiempo(DEL_SERVIDOR, 'mas');
    expect(DEL_SERVIDOR).toEqual(copia);
    expect(ordenarPorTiempo([ped('9', 'CP-Z', ''), DEL_SERVIDOR[0]], 'mas')[0].codigo).toBe('CP-Z');
  });
});

describe('ordenInicial / recordarOrden', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defecto menos; recuerda; la URL manda; valor inválido se ignora', () => {
    expect(ordenInicial('')).toBe('menos');
    recordarOrden('mas');
    expect(ordenInicial('')).toBe('mas');
    expect(ordenInicial('?pedido=112&orden=menos')).toBe('menos');
    expect(ordenInicial('?orden=raro')).toBe('mas');
  });
  it('si el almacenamiento falla no lanza y vale el defecto', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(ordenInicial('')).toBe('menos');
    expect(() => recordarOrden('mas')).not.toThrow();
  });
});

describe('Orden por tiempo en la lista de Caja', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/admin/caja');
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1' }, tiene: vi.fn().mockReturnValue(true) } as any);
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(() => {});
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);
    vi.spyOn(pedidosApi, 'listarNoEntregados').mockResolvedValue({ reprogramar: [], cancelados: [], total: 0 } as any);
    vi.spyOn(pedidosApi, 'listar').mockImplementation(async (f: any) =>
      f?.pendientes ? { total: 0, pagina: 1, limite: 1, items: [] } : { total: 4, pagina: 1, limite: 100, items: DEL_SERVIDOR });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  const abrirPanel = async () => {
    const b = await screen.findByRole('button', { name: /^Filtros/ });
    if (b.getAttribute('aria-expanded') !== 'true') fireEvent.click(b);
    return screen.getByRole('group', { name: 'Orden por tiempo' });
  };

  it('por defecto conserva el orden actual, sin chip, y el control tiene dos opciones accesibles', async () => {
    render(<PedidosAdminView />);
    await screen.findAllByLabelText(/^Pedido CP-/);
    expect(codigos()).toEqual(['CP-D', 'CP-C', 'CP-B', 'CP-A']);
    const grupo = await abrirPanel();
    expect(within(grupo).getByRole('button', { name: /^Menos tiempo primero/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupo).getByRole('button', { name: /^Más tiempo primero/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /Quitar orden/ })).not.toBeInTheDocument();
  });

  it('elegir «más tiempo primero» invierte, muestra el chip, se recuerda y Limpiar filtros no lo borra; el chip lo quita', async () => {
    render(<PedidosAdminView />);
    await screen.findAllByLabelText(/^Pedido CP-/);
    const grupo = await abrirPanel();
    fireEvent.click(within(grupo).getByRole('button', { name: /^Más tiempo primero/ }));
    expect(codigos()).toEqual(['CP-A', 'CP-B', 'CP-C', 'CP-D']);
    expect(localStorage.getItem('caja.ordenTiempo')).toBe('mas');
    const chip = screen.getByRole('button', { name: /Quitar orden/ });
    expect(chip).toHaveTextContent('Orden: más tiempo primero');
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
    fireEvent.click(chip);
    expect(codigos()).toEqual(['CP-D', 'CP-C', 'CP-B', 'CP-A']);
    expect(localStorage.getItem('caja.ordenTiempo')).toBe('menos');
  });

  it('se combina con la pastilla de estado y la búsqueda', async () => {
    window.history.pushState({}, '', '/admin/caja?orden=mas');
    render(<PedidosAdminView />);
    await screen.findAllByLabelText(/^Pedido CP-/);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'cp-' } });
    expect(codigos()).toEqual(['CP-A', 'CP-B', 'CP-C', 'CP-D']);
    fireEvent.change(screen.getByPlaceholderText(/Buscar por código/), { target: { value: 'cp-c' } });
    expect(codigos()).toEqual(['CP-C']);
  });

  it('?pedido=112&orden=menos abre el pedido sin alterar el orden elegido', async () => {
    recordarOrden('mas');
    window.history.pushState({}, '', '/admin/caja?pedido=2&orden=menos');
    render(<PedidosAdminView />);
    await screen.findAllByLabelText(/^Pedido CP-/);
    expect(codigos()).toEqual(['CP-D', 'CP-C', 'CP-B', 'CP-A']);
    await waitFor(() => expect(screen.getAllByText(/CP-B/).length).toBeGreaterThan(1));
  });

  it('el orden es estable aunque pase el reloj (depende de creado_en, no de los minutos)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] });
    try {
      window.history.pushState({}, '', '/admin/caja?orden=mas');
      render(<PedidosAdminView />);
      await vi.waitFor(() => expect(codigos()).toEqual(['CP-A', 'CP-B', 'CP-C', 'CP-D']));
      vi.advanceTimersByTime(10 * 60 * 1000);
      expect(codigos()).toEqual(['CP-A', 'CP-B', 'CP-C', 'CP-D']);
    } finally {
      vi.useRealTimers();
    }
  });
});
