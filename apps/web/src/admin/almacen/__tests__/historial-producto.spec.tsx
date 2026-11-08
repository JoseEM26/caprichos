import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

// Socket falso compartido con el módulo real (para probar `stock:cambio`).
const manejadores: Record<string, Array<(...a: any[]) => void>> = {};
const falso = {
  connected: true,
  on: (e: string, f: any) => ((manejadores[e] ||= []).push(f), falso),
  off: (e: string, f: any) => { manejadores[e] = (manejadores[e] || []).filter((x) => x !== f); return falso; },
  connect: vi.fn(), disconnect: vi.fn(() => falso),
};
vi.mock('socket.io-client', () => ({ io: () => falso }));

import { AperturaDiaView } from '../AperturaDiaView';
import { HistorialProductoBoton, rangoDe } from '../HistorialProductoBoton';
import { almacenApi, type HistorialProductoRespuesta } from '../almacenApi';
import { ErrorApi } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';

const GALLETA = { productoId: 'g1', nombre: 'GALLETA', areaNombre: null, saldo: 10, aperturaHoy: true, aperturaCantidad: 10, producidoHoy: 0, quedaronAyer: 10 };
const DONA = {
  productoId: 'd1', nombre: 'DONA', areaNombre: 'Cocina', saldo: 9, quedaronAyer: 9, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null,
  sabores: [
    { saborId: 's1', nombre: 'Chocolate', saldo: 5, quedaronAyer: 5, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null },
    { saborId: 's2', nombre: 'Vainilla', saldo: 4, quedaronAyer: 4, producidoHoy: 0, aperturaHoy: false, aperturaCantidad: null },
  ],
};

const base = (extra: Partial<HistorialProductoRespuesta> = {}): HistorialProductoRespuesta => ({
  producto: { id: 'g1', nombre: 'GALLETA', sabores: [] },
  desde: '2026-11-08', hasta: '2026-11-08',
  sabor: null,
  resumen: { inicio: 4, subido: 20, vendido: -12, mermas: -2, ajustes: 0, saldo: 10, diferencia: 0, cuadra: true },
  existenciaActual: 10, truncado: false, pagina: 1, porPagina: 50, total: 3,
  eventos: [
    { id: '3', categoria: 'PEDIDO', grupo: 'pedidos', etiqueta: 'Pedido descontó', cantidad: -3, saldoAntes: 13, saldoDespues: 10, fecha: '2026-11-08', hora: '15:20', en: '', sabor: null, saborId: null, por: 'Rosa Díaz', detalle: null, origenRegistrado: true,
      pedido: { id: '95', codigo: 'CP-W095', estado: 'ANULADO', modalidad: 'DELIVERY', cliente: 'Ana', enlace: '/admin/caja?pedido=95', anulado: true, devuelto: 3 } },
    { id: '2', categoria: 'SUBIDA', grupo: 'subidas', etiqueta: 'Subida', cantidad: 20, saldoAntes: -7, saldoDespues: 13, fecha: '2026-11-08', hora: '08:00', en: '', sabor: null, saborId: null, por: 'Luis', detalle: 'Tanda #5', origenRegistrado: true },
    { id: '1', categoria: 'MERMA', grupo: 'mermas', etiqueta: 'Merma', cantidad: -2, saldoAntes: -5, saldoDespues: -7, fecha: '2026-11-08', hora: '07:00', en: '', sabor: null, saborId: null, por: 'Luis', detalle: 'Se cayó', origenRegistrado: true },
  ],
  ...extra,
});

function sesion() {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { rol: 'ADMIN' }, tiene: () => true } as any);
}

describe('Historial del producto en Apertura', () => {
  beforeEach(() => {
    for (const k of Object.keys(manejadores)) delete manejadores[k];
    falso.connected = true;
    sesion();
    vi.spyOn(almacenApi, 'mermasHoy').mockResolvedValue({ fecha: '2026-11-08', mermas: [] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('hay un botón Historial al lado del de merma, en el producto y en cada sabor', async () => {
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-08', productos: [GALLETA, DONA] } as any);
    render(<MemoryRouter><AperturaDiaView /></MemoryRouter>);
    await screen.findByText('GALLETA');
    const merma = screen.getByRole('button', { name: 'Botar a merma GALLETA' });
    const hist = screen.getByRole('button', { name: 'Ver historial de GALLETA' });
    expect(hist.parentElement).toContainElement(merma);
    expect(merma.compareDocumentPosition(hist) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver historial de DONA · Chocolate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver historial de DONA · Vainilla' })).toBeInTheDocument();
  });

  it('el botón del sabor abre el modal ya filtrado por ese sabor', async () => {
    const h = vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base());
    vi.spyOn(almacenApi, 'obtenerApertura').mockResolvedValue({ fecha: '2026-11-08', productos: [DONA] } as any);
    render(<MemoryRouter><AperturaDiaView /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver historial de DONA · Chocolate' }));
    await waitFor(() => expect(h).toHaveBeenCalled());
    expect(h.mock.calls[0][0]).toBe('d1');
    expect(h.mock.calls[0][1]).toMatchObject({ sabor: 's1' });
  });
});

describe('Modal de historial', () => {
  beforeEach(() => {
    for (const k of Object.keys(manejadores)) delete manejadores[k];
    falso.connected = true;
  });
  afterEach(() => vi.restoreAllMocks());

  const abrir = async () => {
    render(<MemoryRouter><HistorialProductoBoton productoId="g1" nombre="GALLETA" /></MemoryRouter>);
    const boton = screen.getByRole('button', { name: 'Ver historial de GALLETA' });
    boton.focus();
    fireEvent.click(boton);
    return boton;
  };

  it('muestra resumen, eventos con signo y el enlace al pedido anulado', async () => {
    vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base());
    await abrir();
    const dialogo = await screen.findByRole('dialog', { name: 'Historial de GALLETA' });
    await within(dialogo).findAllByTestId('historial-evento');
    const resumen = within(dialogo).getByLabelText('Resumen del rango');
    expect(resumen).toHaveTextContent('Inicio 4');
    expect(resumen).toHaveTextContent('Subido +20');
    expect(resumen).toHaveTextContent('Vendido -12');
    expect(resumen).toHaveTextContent('Mermas -2');
    expect(resumen).toHaveTextContent('Saldo 10');
    expect(within(dialogo).getAllByText('+20').length).toBeGreaterThan(1);
    expect(within(dialogo).getAllByText('-3').length).toBeGreaterThan(0);
    expect(within(dialogo).getByText(/anulado · devuelto \+3/)).toBeInTheDocument();
    const enlace = within(dialogo).getByRole('link', { name: 'Abrir pedido CP-W095' });
    expect(enlace).toHaveAttribute('href', '/admin/caja?pedido=95');
    expect(within(dialogo).queryByRole('alert')).toBeNull();
  });

  it('los chips y el día piden de nuevo al servidor con el filtro', async () => {
    const h = vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base());
    await abrir();
    await screen.findAllByTestId('historial-evento');
    fireEvent.click(screen.getByRole('button', { name: 'Mermas' }));
    await waitFor(() => expect(h).toHaveBeenLastCalledWith('g1', expect.objectContaining({ tipo: 'mermas' })));
    fireEvent.click(screen.getByRole('button', { name: 'Ayer' }));
    await waitFor(() => {
      const f = h.mock.calls.at(-1)![1]!;
      expect(f.desde).toBe(f.hasta);
      expect(f.desde).toBe(rangoDe('ayer', '').desde);
    });
  });

  it('avisa la diferencia sin explicar cuando no cuadra', async () => {
    vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base({ resumen: { ...base().resumen, cuadra: false, diferencia: -2 } }));
    await abrir();
    expect(await screen.findByRole('alert')).toHaveTextContent('Diferencia sin explicar: -2');
  });

  it('estado vacío amable, carga y error con reintento', async () => {
    const h = vi.spyOn(almacenApi, 'historialProducto').mockRejectedValueOnce(new ErrorApi('ERR', 'Falló', 500));
    await abrir();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando historial');
    expect(await screen.findByRole('alert')).toHaveTextContent('Falló');
    h.mockResolvedValue(base({ eventos: [], total: 0 }));
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(await screen.findByText('Sin movimientos hoy')).toBeInTheDocument();
  });

  it('se actualiza en vivo con stock:cambio', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const h = vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base());
    await abrir();
    await screen.findAllByTestId('historial-evento');
    const antes = h.mock.calls.length;
    h.mockResolvedValue(base({ resumen: { ...base().resumen, saldo: 7 } }));
    await act(async () => {
      (manejadores['stock:cambio'] || []).slice().forEach((f) => f());
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(h.mock.calls.length).toBeGreaterThan(antes);
    expect(screen.getByLabelText('Resumen del rango')).toHaveTextContent('Saldo 7');
    vi.useRealTimers();
  });

  it('Escape cierra y el foco vuelve al botón', async () => {
    vi.spyOn(almacenApi, 'historialProducto').mockResolvedValue(base());
    const boton = await abrir();
    const dialogo = await screen.findByRole('dialog');
    await screen.findAllByTestId('historial-evento');
    expect(dialogo.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(boton).toHaveFocus();
  });
});
