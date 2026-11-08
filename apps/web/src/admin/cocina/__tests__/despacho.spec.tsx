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
    {
      areaId: '2',
      areaNombre: 'Bar',
      listo: false,
      lineas: [linea('b', 'Dona', { cantidad: 6, sabor: '3 Fresa · 3 Oreo', sabores: [{ nombre: 'Fresa', cantidad: 3 }, { nombre: 'Oreo', cantidad: 3 }] })],
    },
  ],
  completo: false,
  estado: 'PREPARANDO',
  despachado: false,
  atendido: false,
  atendido_en: null,
  atendido_por: null,
  ...over,
});

const completo = (over: Partial<PedidoDespacho> = {}) => {
  const p = pedido(over);
  return { ...p, areas: p.areas.map((a) => ({ ...a, listo: true })), completo: true };
};

const respuesta = (pedidos: PedidoDespacho[]) => ({ ahoraServidor: new Date().toISOString(), umbrales: { naranjaMin: 35, rojoMin: 50 }, pedidos });

describe('DespachoView (el LISTO final)', () => {
  let eventos: Record<string, () => void>;
  beforeEach(() => {
    vi.clearAllMocks();
    eventos = {};
    vi.spyOn(socketModulo, 'useEventos').mockImplementation(((ev: string, fn: () => void) => {
      eventos[ev] = fn;
    }) as any);
    vi.spyOn(socketModulo, 'useTiempoReal').mockImplementation((() => {}) as any);
  });

  it('una tarjeta por pedido: código, modalidad con ícono, mesa y cliente, áreas en semáforo con productos y sabores', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    render(<DespachoView />);
    const tarjeta = await screen.findByTestId('pedido-despacho-1');
    expect(within(tarjeta).getByText('CP-001')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Mesa 4 · Ana')).toBeInTheDocument();
    expect(screen.getByTestId('modalidad-1')).toHaveTextContent('🍽️ En mesa');
    expect(within(screen.getByTestId('area-1-1')).getByText('Waffle', { exact: false })).toBeInTheDocument();
    expect(screen.getByTestId('estado-area-1-1')).toHaveTextContent('Lista');
    expect(screen.getByTestId('estado-area-1-2')).toHaveTextContent('Falta');
    expect(within(screen.getByTestId('area-1-2')).getByTestId('linea-sabores')).toHaveTextContent('3 Fresa · 3 Oreo');
    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('Faltan 1 de 2');
    expect(screen.getByTestId('contador-en-despacho')).toHaveTextContent('1 en despacho');
  });

  it('el ícono de la modalidad cambia: delivery moto, recoger bolsa', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(
      respuesta([pedido({ modalidad: 'DELIVERY', mesa: null }), pedido({ pedidoId: '2', codigo: 'CP-002', modalidad: 'RECOGER', mesa: null })]),
    );
    render(<DespachoView />);
    expect(await screen.findByTestId('modalidad-1')).toHaveTextContent('🛵');
    expect(screen.getByTestId('modalidad-2')).toHaveTextContent('🛍️');
  });

  it('«Todo completo · despachar» está deshabilitado hasta que todas las áreas estén listas', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    const despachar = vi.spyOn(cocinaApi, 'despacharCompleto').mockResolvedValue({ ok: true, completo: true, parcial: false, estado: 'LISTO' });
    render(<DespachoView />);
    const boton = await screen.findByTestId('despachar-1');
    expect(boton).toBeDisabled();
    expect(screen.getByText('Falta: Bar')).toBeInTheDocument();
    fireEvent.click(boton);
    expect(despachar).not.toHaveBeenCalled();
  });

  it('completo: el botón se activa, despacha y recarga (el pedido sale de la lista)', async () => {
    const listar = vi.spyOn(cocinaApi, 'listarDespacho');
    listar.mockResolvedValueOnce(respuesta([completo()])).mockResolvedValue(respuesta([]));
    const despachar = vi.spyOn(cocinaApi, 'despacharCompleto').mockResolvedValue({ ok: true, completo: true, parcial: false, estado: 'LISTO' });
    render(<DespachoView />);
    expect(await screen.findByTestId('estado-pedido-1')).toHaveTextContent('COMPLETO');
    const boton = screen.getByTestId('despachar-1');
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('1', false));
    await waitFor(() => expect(screen.queryByTestId('pedido-despacho-1')).not.toBeInTheDocument());
  });

  it('despacho parcial: pide confirmación Sí/No y deja el resto pendiente; No no hace nada', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    const despachar = vi.spyOn(cocinaApi, 'despacharCompleto').mockResolvedValue({ ok: true, completo: false, parcial: true, estado: 'PREPARANDO' });
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('despachar-parcial-1'));
    expect(await screen.findByText(/queda pendiente: Bar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(despachar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('despachar-parcial-1'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, despachar' }));
    await waitFor(() => expect(despachar).toHaveBeenCalledWith('1', true));
  });

  it('sin ningún área lista no hay despacho parcial', async () => {
    const p = pedido();
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([{ ...p, areas: p.areas.map((a) => ({ ...a, listo: false })) }]));
    render(<DespachoView />);
    await screen.findByTestId('despachar-1');
    expect(screen.queryByTestId('despachar-parcial-1')).not.toBeInTheDocument();
  });

  it('un área ya enviada en un parcial se ve «Ya salió» y no ofrece devolverla', async () => {
    const p = pedido();
    p.areas = [{ ...p.areas[0], despachada: true }, p.areas[1]];
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([p]));
    render(<DespachoView />);
    expect(await screen.findByTestId('estado-area-1-1')).toHaveTextContent('Ya salió');
  });

  it('«Devolver al área» confirma y reabre esa área en cocina', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([completo()]));
    const devolver = vi.spyOn(cocinaApi, 'devolverComanda').mockResolvedValue({ ok: true });
    render(<DespachoView />);
    fireEvent.click(await screen.findByTestId('devolver-1-2'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, devolver' }));
    await waitFor(() => expect(devolver).toHaveBeenCalledWith('1', '2'));
  });

  it('sin permiso para despachar la tarjeta no trae botones', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([completo()]));
    render(<DespachoView puedeDespachar={false} />);
    await screen.findByTestId('pedido-despacho-1');
    expect(screen.queryByTestId('despachar-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('devolver-1-1')).not.toBeInTheDocument();
  });

  it('«Ver despachados» pide también los ya despachados, atenuados y sin botón', async () => {
    const hecho = completo({ despachado: true, estado: 'LISTO' });
    const listar = vi.spyOn(cocinaApi, 'listarDespacho').mockImplementation(async (a) => respuesta(a ? [hecho] : []));
    render(<DespachoView />);
    await screen.findByTestId('despacho-vacio');
    fireEvent.click(screen.getByRole('switch', { name: 'Ver despachados' }));
    const tarjeta = await screen.findByTestId('pedido-despacho-1');
    expect(listar).toHaveBeenLastCalledWith(true);
    expect(tarjeta).toHaveAttribute('data-despachado', 'true');
    expect(tarjeta.style.opacity).toBe(''); // atenuado con fondo propio, sin opacidad (mantiene el contraste)
    expect(tarjeta.style.background).toBe('rgb(239, 230, 216)');
    expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('DESPACHADO');
    expect(screen.queryByTestId('despachar-1')).not.toBeInTheDocument();
  });

  it('orden: primero los completos que esperan, luego el más viejo', async () => {
    const viejo = pedido({ pedidoId: '2', codigo: 'CP-002', creado_en: new Date(Date.now() - 30 * 60000).toISOString() });
    const listo = completo({ pedidoId: '3', codigo: 'CP-003', creado_en: new Date(Date.now() - 5 * 60000).toISOString() });
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido(), viejo, listo]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-2');
    const codigos = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
    expect(codigos).toEqual(['Pedido CP-003', 'Pedido CP-002', 'Pedido CP-001']);
  });

  it('tiempo real: un evento recarga y suena cuando un pedido pasa a completo', async () => {
    const listar = vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-1');
    listar.mockResolvedValue(respuesta([completo()]));
    await act(async () => {
      eventos['cocina:comanda']();
    });
    await waitFor(() => expect(screen.getByTestId('estado-pedido-1')).toHaveTextContent('COMPLETO'));
    expect(reproducirCampanaCocina).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('se suscribe a pedido:estado y cocina:comanda para recargar', async () => {
    vi.spyOn(cocinaApi, 'listarDespacho').mockResolvedValue(respuesta([pedido()]));
    render(<DespachoView />);
    await screen.findByTestId('pedido-despacho-1');
    expect(Object.keys(eventos)).toEqual(expect.arrayContaining(['cocina:comanda', 'pedido:estado']));
  });
});
