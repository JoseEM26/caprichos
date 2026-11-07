import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { DespachoView } from '../DespachoView';
import type { PedidoDespacho } from '../cocinaTipos';
import * as cocinaApi from '../cocinaApi';
import * as socketModulo from '../../../comun/socket';
import { reproducirCampanaCocina } from '../audioAlerta';

vi.mock('../audioAlerta', () => ({
  reproducirCampanaCocina: vi.fn(),
  estaSilenciado: vi.fn().mockReturnValue(false),
  setSilenciado: vi.fn(),
}));

const linea = (id: string, nombre: string, extra: any = {}) => ({ id, nombre, cantidad: 1, opciones: [], personas: [], nota: null, ...extra });

const pedido = (over: Partial<PedidoDespacho> = {}): PedidoDespacho => ({
  pedidoId: '1',
  codigo: 'CP-001',
  modalidad: 'MESA',
  cliente: 'Ana',
  mesa: '4',
  nota: null,
  creado_en: new Date(Date.now() - 12 * 60000).toISOString(),
  minutos: 12,
  direccion: null,
  referencia: null,
  telefono: null,
  areas: [
    { areaId: '1', areaNombre: 'Cocina', listo: true, lineas: [linea('a', 'Waffle', { tamano: 'Grande', opciones: [{ nombre: 'Miel' }], nota: 'sin nueces' })] },
    { areaId: '2', areaNombre: 'Bar', listo: false, lineas: [linea('b', 'Latte')] },
  ],
  completo: false,
  atendido: false,
  atendido_en: null,
  atendido_por: null,
  ...over,
});

const respuesta = (pedidos: PedidoDespacho[]) => ({ ahoraServidor: new Date().toISOString(), umbrales: { naranjaMin: 35, rojoMin: 50 }, pedidos });

describe('DespachoView', () => {
  let eventos: Record<string, () => void>;
  beforeEach(() => {
    vi.clearAllMocks();
    eventos = {};
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: () => void) => {
      eventos[ev] = fn;
    }) as any);
    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation((() => {}) as any);
  });

  it('muestra el pedido con sus productos agrupados por área y el estado de cada una', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    render(<DespachoView />);
    const tarjeta = await screen.findByTestId('pedido-despacho-1');
    expect(within(tarjeta).getByText('CP-001')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Mesa 4 · Ana')).toBeInTheDocument();
    expect(within(screen.getByTestId('area-1-1')).getByText('Waffle', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('estado-area-1-1')).toHaveTextContent('Lista');
    expect(screen.getByTestId('estado-area-1-2')).toHaveTextContent('Pendiente');
    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('Faltan 1 de 2');
  });

  it('completo cuando todas las áreas están listas', async () => {
    const p = pedido();
    p.areas = p.areas.map((a) => ({ ...a, listo: true }));
    p.completo = true;
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([p]));
    render(<DespachoView />);
    expect(await screen.findByTestId('estado-pedido-1')).toHaveTextContent('COMPLETO');
    expect(screen.getByTestId('pedido-despacho-1')).toHaveAttribute('data-completo', 'true');
  });

  it('el check marca atendido y recarga; los atendidos salen ocultos', async () => {
    const listar = vi.spyOn(cocinaApi, 'listarDespacho');
    listar.mockResolvedValueOnce(respuesta([pedido()])).mockResolvedValue(respuesta([]));
    const marcar = vi.spyOn(cocinaApi, 'marcarPedidoAtendido').mockResolvedValue({ ok: true, atendido: true });
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('check-atendido-1'));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('1', true));
    await waitFor(() => expect(screen.queryByTestId('pedido-despacho-1')).not.toBeInTheDocument());
    expect(screen.getByTestId('despacho-vacio')).toBeInTheDocument();
  });

  it('«Ver atendidos» pide también los atendidos y los muestra atenuados; el check los reabre', async () => {
    const atendido = pedido({ atendido: true, atendido_por: 'Luis', atendido_en: new Date().toISOString() });
    const listar = vi.spyOn(cocinaApi, 'listarDespacho').mockImplementation(async (a) => respuesta(a ? [atendido] : []));
    const marcar = vi.spyOn(cocinaApi, 'marcarPedidoAtendido').mockResolvedValue({ ok: true, atendido: false });
    render(<DespachoView />);
    await screen.findByTestId('despacho-vacio');
    fireEvent.click(screen.getByRole('switch', { name: 'Ver atendidos' }));
    const tarjeta = await screen.findByTestId('pedido-despacho-1');
    expect(listar).toHaveBeenLastCalledWith(true);
    expect(tarjeta).toHaveAttribute('data-atendido', 'true');
    expect(tarjeta.style.opacity).toBe('0.55');
    expect(within(tarjeta).getByText('Atendido por Luis')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('check-atendido-1'));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('1', false));
  });

  it('ordena por antigüedad: el más viejo primero', async () => {
    const viejo = pedido({ pedidoId: '2', codigo: 'CP-002', creado_en: new Date(Date.now() - 30 * 60000).toISOString() });
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido(), viejo]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-2');
    const codigos = screen.getAllByRole('button', { name: /^Abrir el pedido/ }).map((b) => b.getAttribute('aria-label'));
    expect(codigos).toEqual(['Abrir el pedido CP-002', 'Abrir el pedido CP-001']);
  });

  it('al tocar la tarjeta abre el detalle grande con productos, opciones y notas, y el mismo check', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    const marcar = vi.spyOn(cocinaApi, 'marcarPedidoAtendido').mockResolvedValue({ ok: true, atendido: true });
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('pedido-despacho-1'));
    const detalle = await screen.findByTestId('detalle-despacho');
    expect(within(detalle).getByText('Grande · Miel')).toBeInTheDocument();
    expect(within(detalle).getByText('sin nueces')).toBeInTheDocument();
    expect(within(detalle).getByText('Latte', { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('check-atendido-1').at(-1)!);
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('1', true));
  });

  it('delivery: el detalle trae cliente, teléfono y dirección', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(
      respuesta([pedido({ modalidad: 'DELIVERY', mesa: null, direccion: 'Av. Sol 123', referencia: 'Portón azul', telefono: '999888777' })]),
    );
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('pedido-despacho-1'));
    fireEvent.click(await screen.findByRole('tab', { name: 'Entrega' }));
    expect(await screen.findByText('Av. Sol 123', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('999888777', { exact: false })).toBeInTheDocument();
  });

  it('tiempo real: un evento recarga y suena cuando un pedido pasa a completo', async () => {
    const listar = vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-1');
    const p = pedido({ completo: true });
    p.areas = p.areas.map((a) => ({ ...a, listo: true }));
    listar.mockResolvedValue(respuesta([p]));
    await act(async () => {
      eventos['cocina:comanda']();
    });
    await waitFor(() => expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('COMPLETO'));
    expect(reproducirCampanaCocina).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledTimes(2);
  });
});
