import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { listarProductos, listarPedidos, registrarSeparada } = vi.hoisted(() => ({
  listarProductos: vi.fn(),
  listarPedidos: vi.fn(),
  registrarSeparada: vi.fn(),
}));
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ usuario: { rol: 'CAJERO' } }) }));
vi.mock('../../catalogo/catalogoApi', () => ({ catalogoApi: { listarProductos } }));
vi.mock('../../pedidos/pedidosApi', () => ({ pedidosApi: { listar: listarPedidos } }));
vi.mock('../cortesiasApi', async (orig) => ({ ...(await orig<any>()), cortesiasApi: { registrarSeparada } }));

import { RegistrarCortesiaModal } from '../RegistrarCortesiaModal';

const prod = (o: any) => ({ disponible: true, controlaStock: false, tamanos: [], sabores: [], grupos: [], ...o });
const PRODUCTOS = [
  prod({ id: '1', nombre: 'Frappe Oreo', categoriaId: 'a', categoria: { id: 'a', nombre: 'Bebidas' }, tamanos: [{ id: '9', nombre: 'Grande' }] }),
  prod({ id: '2', nombre: 'Dona', categoriaId: 'b', categoria: { id: 'b', nombre: 'Postres' }, controlaStock: true, sabores: [{ id: '5', nombre: 'Fresa', quedan: 3 }, { id: '6', nombre: 'Choco', quedan: 0 }] }),
  prod({ id: '3', nombre: 'Combo Pareja', categoriaId: 'c', categoria: { id: 'c', nombre: 'Combos' }, disponible: false }),
];
const pedido = (i: number, o: any = {}) => ({
  id: String(100 + i), codigo: `CP-W${String(i).padStart(3, '0')}`, cliente_nombre: `Cliente ${i}`, modalidad: 'MESA', estado: 'ENTREGADO', total: 20,
  canal: 'MOZO', creado_en: '2026-11-06T15:00:00Z', pago_estado: 'PAGADO', lineas: [{ id: 'l' + i, nombre: 'Waffle', cantidad: 2, subtotal: 20 }], ...o,
});

beforeEach(() => {
  vi.clearAllMocks();
  listarProductos.mockResolvedValue(PRODUCTOS);
  listarPedidos.mockImplementation(async (f: any) => ({
    items: Array.from({ length: 15 }, (_, i) => pedido(i + 1)).filter((p) => !f.buscar || p.codigo.includes(f.buscar.toUpperCase())),
  }));
  registrarSeparada.mockResolvedValue({});
});

const abrir = async () => {
  render(<RegistrarCortesiaModal alCerrar={vi.fn()} alRegistrar={vi.fn()} />);
  await screen.findByRole('option', { name: /Frappe Oreo/ });
};
const clic = (n: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: n }));

describe('Cortesía en pasos', () => {
  it('no avanza con el paso incompleto y explica qué falta', async () => {
    await abrir();
    clic('Siguiente');
    expect(screen.getByRole('alert')).toHaveTextContent('Elige el producto');
    fireEvent.click(screen.getByRole('option', { name: /Frappe Oreo/ }));
    clic('Siguiente');
    expect(screen.getByRole('alert')).toHaveTextContent('tamaño');
    fireEvent.change(screen.getByLabelText('Tamaño'), { target: { value: '9' } });
    clic('Siguiente');
    expect(screen.getByText('Motivo (obligatorio)')).toBeTruthy();
    clic('Siguiente');
    expect(screen.getByRole('alert')).toHaveTextContent('motivo');
    fireEvent.click(screen.getByLabelText('Otro'));
    clic('Siguiente');
    expect(screen.getByRole('alert')).toHaveTextContent('nota');
  });

  it('filtra productos por categoría y buscador; agotado deshabilitado; sabor agotado deshabilitado', async () => {
    await abrir();
    expect((screen.getByRole('option', { name: /Combo Pareja/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Agotado')).toBeTruthy();
    expect(screen.getByText('Quedan 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Postres' }));
    expect(screen.queryByRole('option', { name: /Frappe/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'FRAPPÉ' } });
    expect(screen.queryByRole('option', { name: /Dona/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Buscar producto'), { target: { value: 'dona' } });
    fireEvent.click(screen.getByRole('option', { name: /Dona/ }));
    expect((screen.getByRole('button', { name: /Choco/ }) as HTMLButtonElement).disabled).toBe(true);
    clic('Siguiente');
    expect(screen.getByRole('alert')).toHaveTextContent('sabor');
  });

  it('combobox de pedidos: máx. 12, filtra, selecciona con teclado y ver detalle no pierde nada', async () => {
    await abrir();
    fireEvent.click(screen.getByRole('option', { name: /Dona/ }));
    fireEvent.click(screen.getByRole('button', { name: /Fresa/ }));
    clic('Siguiente');
    fireEvent.click(screen.getByLabelText('Error de cocina'));
    clic('Siguiente');
    const combo = screen.getByRole('combobox', { name: 'Pedido de referencia' });
    fireEvent.focus(combo);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(12));
    expect(listarPedidos).toHaveBeenCalledWith({ limite: 12 });
    expect(screen.getByText(/Mostrando los 12 más recientes; escribe para afinar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalle de CP-W002' }));
    expect(screen.getByRole('region', { name: 'Detalle de CP-W002' })).toHaveTextContent('2 × Waffle');
    expect(screen.getAllByRole('option')).toHaveLength(12);
    fireEvent.change(combo, { target: { value: 'cp-w013' } });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(listarPedidos).toHaveBeenLastCalledWith({ limite: 12, buscar: 'cp-w013' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' });
    fireEvent.keyDown(combo, { key: 'Enter' });
    expect(screen.getByText(/Resumen/)).toBeTruthy();
    expect(screen.getByLabelText('Resumen de la cortesía')).toHaveTextContent('CP-W013');
  });

  it('registra con el mismo payload de siempre (clic en la fila)', async () => {
    const alRegistrar = vi.fn();
    render(<RegistrarCortesiaModal alCerrar={vi.fn()} alRegistrar={alRegistrar} />);
    fireEvent.click(await screen.findByRole('option', { name: /Frappe Oreo/ }));
    fireEvent.change(screen.getByLabelText('Tamaño'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '2' } });
    clic('Siguiente');
    fireEvent.click(screen.getByLabelText('Error de cocina'));
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: ' se demoró ' } });
    clic('Siguiente');
    fireEvent.focus(screen.getByRole('combobox'));
    const fila = await screen.findByRole('option', { name: /CP-W003/ });
    fireEvent.click(fila);
    clic('Registrar cortesía');
    await waitFor(() => expect(alRegistrar).toHaveBeenCalledWith('CP-W003'));
    expect(registrarSeparada).toHaveBeenCalledWith(
      { productoId: '1', tamanoId: '9', cantidad: 2, motivo: 'ERROR_COCINA', nota: 'se demoró', pedidoReferenciaId: '103' },
      undefined,
    );
  });

  it('un error de stock del servidor vuelve al paso 1 y se muestra', async () => {
    registrarSeparada.mockRejectedValue({ codigo: 'STOCK_INSUFICIENTE', mensaje: 'Solo quedan 1 de Dona' });
    await abrir();
    fireEvent.click(screen.getByRole('option', { name: /Frappe Oreo/ }));
    fireEvent.change(screen.getByLabelText('Tamaño'), { target: { value: '9' } });
    clic('Siguiente');
    fireEvent.click(screen.getByLabelText('Prueba'));
    clic('Siguiente');
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name: /CP-W001/ }));
    clic('Registrar cortesía');
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo quedan 1 de Dona');
    expect(screen.getByLabelText('Tamaño')).toBeTruthy();
  });
});
