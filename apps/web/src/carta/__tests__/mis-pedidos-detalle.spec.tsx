import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { useEffect } from 'react';
import * as cuentaModulo from '../cuenta/CuentaContext';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { MisPedidos } from '../MisPedidos';
import { api } from '../../comun/api';

const hace = (dias: number, horas = 0) => new Date(Date.now() - dias * 86_400_000 - horas * 3_600_000).toISOString();
const fila = (codigo: string, extra: any = {}) => ({
  codigo, estado: 'ENTREGADO', estadoEtiqueta: 'Entregado', modalidad: 'RECOGER', total: 15, terminado: true, anulado: false,
  creadoEn: hace(0), resumen: '1 x Frappe', seguimientoToken: `t-${codigo}`, pasos: [], ...extra,
});

const seguimiento = (codigo: string, extra: any = {}) => ({
  codigo, estado: 'COLA', estadoEtiqueta: 'En cola', modalidad: 'COMER_LOCAL', total: 21.5, terminado: false, anulado: false,
  cancelable: { puede: true },
  pasos: [
    { clave: 'recibido', etiqueta: 'Recibido', hecho: true, actual: true, hora: '2026-11-20T18:00:00Z' },
    { clave: 'cocina', etiqueta: 'En cocina', hecho: false, actual: false, hora: null },
  ],
  detalle: {
    subtotal: 25, descuento: 3.5, envio: null, puntosCanjeados: 0, nota: null,
    descuentos: [{ nombre: 'Descuento del personal 14%', monto: 3.5 }],
    lineas: [
      { nombre: 'Frappe Oreo', cantidad: 2, nota: null, tamano: 'Grande', opciones: ['Leche: Deslactosada'], sabores: [], nombresPersona: ['Rosa'], precioUnit: 12.5, subtotal: 25 },
      { nombre: 'Galletas', cantidad: 1, nota: null, sabores: ['2 × Fresa'], opciones: [] },
    ],
  },
  ...extra,
});

function montar(pedidos: any[], seg: Record<string, any> = {}) {
  vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: { partyId: '1', nombre: 'José', puntos: 0 } } as any);
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.startsWith('/carta/cuenta/pedidos')) return { hayMas: false, pagina: 1, pedidos } as any;
    const m = url.match(/\/carta\/seguimiento\/([^?/]+)/);
    if (m && seg[decodeURIComponent(m[1])]) return seg[decodeURIComponent(m[1])];
    return { requiereBoton: false } as any;
  });
  function Abrir() {
    const { setListaPedidosAbierta } = useCarrito();
    useEffect(() => setListaPedidosAbierta(true), [setListaPedidosAbierta]);
    return null;
  }
  render(<CarritoProvider><Abrir /><MisPedidos /></CarritoProvider>);
}

describe('Mis pedidos: orden, grupos y detalle', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it('«En curso» primero (el más reciente arriba) y «Anteriores» por día: Hoy, Ayer y fecha', async () => {
    montar([
      fila('CP-A', { creadoEn: new Date(Date.now() - 1000).toISOString() }),
      fila('CP-B', { creadoEn: hace(1) }),
      fila('CP-C', { creadoEn: hace(6) }),
      fila('CP-X', { terminado: false, estado: 'COLA', estadoEtiqueta: 'En cola', creadoEn: hace(0, 3) }),
      fila('CP-Y', { terminado: false, estado: 'PREPARANDO', estadoEtiqueta: 'Preparando', creadoEn: hace(0, 1) }),
    ]);
    await screen.findByText('#CP-Y');
    const textos = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => t.startsWith('#CP-'));
    expect(textos.map((t) => t.slice(1, 5))).toEqual(['CP-Y', 'CP-X', 'CP-A', 'CP-B', 'CP-C']);
    expect(screen.getByText('En curso')).toBeInTheDocument();
    expect(screen.getByText('Anteriores')).toBeInTheDocument();
    const dias = screen.getAllByTestId('grupo-dia').map((e) => e.textContent);
    expect(dias.slice(0, 2)).toEqual(['Hoy', 'Ayer']);
    expect(dias).toHaveLength(3);
  });

  it('muestra de a 6 anteriores y «Ver más» trae el resto', async () => {
    montar(Array.from({ length: 9 }, (_, i) => fila(`CP-${i}`, { creadoEn: new Date(Date.now() - (i + 1) * 1000).toISOString() })));
    await screen.findByText('#CP-0');
    expect(screen.queryByText('#CP-8')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(await screen.findByText('#CP-8')).toBeInTheDocument();
  });

  it('el detalle muestra productos con tamaño, opciones, sabores, nombre del vaso, descuentos, total y la línea de tiempo', async () => {
    montar([fila('CP-W435', { terminado: false, estado: 'COLA', estadoEtiqueta: 'En cola', modalidad: 'COMER_LOCAL' })], { 'CP-W435': seguimiento('CP-W435') });
    fireEvent.click(await screen.findByText('#CP-W435'));
    const lineas = await screen.findAllByTestId('linea-detalle');
    expect(lineas).toHaveLength(2);
    expect(within(lineas[0]).getByText(/2 × Frappe Oreo \(Grande\)/)).toBeInTheDocument();
    expect(within(lineas[0]).getByText('S/ 25.00')).toBeInTheDocument();
    expect(within(lineas[0]).getByText('Leche: Deslactosada')).toBeInTheDocument();
    expect(within(lineas[0]).getByText('Nombre en el vaso: Rosa')).toBeInTheDocument();
    expect(within(lineas[1]).getByText('2 × Fresa')).toBeInTheDocument();
    expect(screen.getByText('Descuento del personal 14%')).toBeInTheDocument();
    expect(screen.getByText('Recibido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver seguimiento' })).toBeInTheDocument();
  });

  it('el detalle de un pedido sin pagar y en cola ofrece «Cancelar pedido» y lo cancela con su token', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
    montar([fila('CP-W435', { terminado: false, estado: 'COLA', estadoEtiqueta: 'En cola' })], { 'CP-W435': seguimiento('CP-W435') });
    fireEvent.click(await screen.findByText('#CP-W435'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/carta/pedidos/CP-W435/cancelar?t=t-CP-W435', {}));
  });

  it('si no se puede cancelar, el detalle dice el motivo real y no muestra el botón', async () => {
    montar([fila('CP-W435', { terminado: false, estado: 'PREPARANDO', estadoEtiqueta: 'Preparando' })], {
      'CP-W435': seguimiento('CP-W435', { estado: 'PREPARANDO', cancelable: { puede: false, mensaje: 'Ya no se puede cancelar: tu pedido ya está en preparación.' } }),
    });
    fireEvent.click(await screen.findByText('#CP-W435'));
    expect((await screen.findByTestId('no-cancelable')).textContent).toMatch(/en preparación/);
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).toBeNull();
  });
});
