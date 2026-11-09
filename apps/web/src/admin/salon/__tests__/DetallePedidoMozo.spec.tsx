import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { DetallePedidoMozo } from '../DetallePedidoMozo';
import { pedidosApi } from '../../pedidos/pedidosApi';
import { api } from '../../../comun/api';

const TODOS = ['pedidos/corregir_cliente', 'pedidos/ajustar_pago', 'pedidos/extra', 'pedidos/anular', 'pedidos/reimprimir_ticket'];
let permisos = new Set(TODOS);
vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: (p: string) => permisos.has(p) }) }));

const linea = (nombre: string) => ({ id: nombre, nombre, cantidad: 2, tamano: 'Grande', opciones: ['Oreo'], nota: null, precioUnit: 5, subtotal: 10, lista: false });
const pedido: any = {
  id: '11', codigo: 'CP-M011', estado: 'PREPARANDO', modalidad: 'MESA', mesaNombre: 'Mesa 3', clienteNombre: 'Ana', total: 10,
  pagoEstado: 'PENDIENTE', pagoMetodo: 'YAPE', vouchers: 0, tieneVoucherLegible: false, creadoEn: '2026-10-29T15:10:00Z', lineas: [linea('Frappé')],
  progreso: { etapa: 'EN_COCINA', etiqueta: 'En cocina', areas: [{ nombre: 'Bebidas', estado: 'PREPARANDO', lineas: 1 }, { nombre: 'Cocina', estado: 'LISTA', lineas: 1 }], porcentaje: 50, listasDe: 1, totalAreas: 2, enCamino: false },
};
const extra: any = { ...pedido, id: '12', codigo: 'CP-M012', pedidoOrigenId: '11', estado: 'COLA', lineas: [linea('Torta')], progreso: { ...pedido.progreso, areas: [{ nombre: 'Pastelería', estado: 'PENDIENTE', lineas: 1 }], porcentaje: 0 } };

const props = () => ({ pedido, extras: [extra], alCerrar: vi.fn(), alCambio: vi.fn(), alExtra: vi.fn(), alAnular: vi.fn() });

beforeEach(() => {
  vi.restoreAllMocks();
  permisos = new Set(TODOS);
  vi.spyOn(pedidosApi, 'obtenerPorId').mockResolvedValue({
    id: '11', codigo: 'CP-M011', cliente_nombre: 'Ana', cliente_telefono: '987654321', modalidad: 'MESA', total: 10, estado: 'PREPARANDO',
    eventos: [{ id: 'e1', tipo: 'estado', titulo: 'Pasó a preparando', detalle: null, en: '2026-10-29T15:12:00Z', por: 'Cocina' }],
  } as any);
});

describe('DetallePedidoMozo', () => {
  it('es un diálogo con 3 pasos; el paso 1 muestra productos, áreas y el extra con su estado', () => {
    render(<DetallePedidoMozo {...props()} />);
    const d = screen.getByRole('dialog', { name: 'Pedido CP-M011' });
    expect(within(d).getAllByRole('tab').map((t) => t.textContent)).toEqual(['1 · Pedido', '2 · Cliente y pago', '3 · Estado y acciones']);
    expect(within(d).getByText('Bebidas: Preparando')).toBeInTheDocument();
    expect(within(d).getByText('Cocina: Lista')).toBeInTheDocument();
    const ex = within(d).getByTestId('dpm-extra');
    expect(within(ex).getByText('EXTRA')).toBeInTheDocument();
    expect(within(ex).getByText('Pastelería: Pendiente')).toBeInTheDocument();
    expect(within(ex).getByText('Torta')).toBeInTheDocument();
    expect(within(d).getByText(/solo los edita Caja o Admin/)).toBeInTheDocument();
  });

  it('paso 2: edita y guarda los datos del cliente con el endpoint de corregir cliente', async () => {
    const guardar = vi.spyOn(pedidosApi, 'corregirCliente').mockResolvedValue({ avisosPendientes: 0, numeroDeCuenta: null });
    const p = props();
    render(<DetallePedidoMozo {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Cliente y pago/ }));
    const cel = await screen.findByLabelText(/Celular/);
    await waitFor(() => expect(cel).toHaveValue('987654321'));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana María' } });
    fireEvent.change(cel, { target: { value: '912345678' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar datos del cliente' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith('11', { nombre: 'Ana María', telefono: '912345678' }));
    await waitFor(() => expect(p.alCambio).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Cambiar método de pago' })).toBeInTheDocument();
  });

  it('celular inválido bloquea el guardado', async () => {
    render(<DetallePedidoMozo {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Cliente y pago/ }));
    const cel = await screen.findByLabelText(/Celular/);
    await waitFor(() => expect(cel).toHaveValue('987654321'));
    fireEvent.change(cel, { target: { value: '12' } });
    expect(screen.getByRole('button', { name: 'Guardar datos del cliente' })).toBeDisabled();
  });

  it('sin permiso, los datos del cliente quedan en solo lectura', () => {
    permisos.delete('pedidos/corregir_cliente');
    render(<DetallePedidoMozo {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Cliente y pago/ }));
    expect(screen.getByLabelText('Nombre')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar datos del cliente' })).toBeNull();
  });

  it('paso 3: historial, reimprimir con confirmación, extra y anular', async () => {
    const reimp = vi.spyOn(api, 'post').mockResolvedValue({ cantidad: 1, omitidos: [], porMaquina: [] } as any);
    const p = props();
    render(<DetallePedidoMozo {...p} />);
    fireEvent.click(screen.getByRole('tab', { name: /Estado y acciones/ }));
    expect(await screen.findByText('Pasó a preparando')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reimprimir comprobante de pago' }));
    fireEvent.click(await screen.findByRole('button', { name: /Sí, reimprimir/ }));
    await waitFor(() => expect(reimp).toHaveBeenCalledWith('/admin/pedidos/11/ticket/reimprimir', {}));
    expect(await screen.findByText(/Comprobante enviado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Pedido extra' }));
    expect(p.alExtra).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Anular pedido' }));
    expect(p.alAnular).toHaveBeenCalled();
  });

  it('sin permiso de impresión no se ofrece reimprimir', () => {
    permisos.delete('pedidos/reimprimir_ticket');
    render(<DetallePedidoMozo {...props()} />);
    fireEvent.click(screen.getByRole('tab', { name: /Estado y acciones/ }));
    expect(screen.queryByRole('button', { name: 'Reimprimir comprobante de pago' })).toBeNull();
  });

  it('Esc cierra y Siguiente/Anterior recorren los pasos', () => {
    const p = props();
    render(<DetallePedidoMozo {...p} />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByRole('tab', { name: /Cliente y pago/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(screen.getByRole('tab', { name: /1 · Pedido/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(p.alCerrar).toHaveBeenCalled();
  });
});
