import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: () => true }) }));
vi.mock('../api', () => ({
  salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() },
}));
vi.mock('../../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({ ModalNuevoPedidoMesa: () => null }));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn(), guardarPlanPago: vi.fn().mockResolvedValue({ ok: true }) },
}));

const pedido = (extra: Record<string, unknown>) => ({
  estado: 'ENTREGADO',
  modalidad: 'MESA',
  mesaNombre: 'Mesa 3',
  clienteNombre: null,
  total: 24.5,
  pagoEstado: 'PENDIENTE',
  pagoMetodo: null,
  creadoEn: '2026-10-29T15:10:00Z',
  lineas: [{ nombre: 'Café', cantidad: 2 }],
  vouchers: 0,
  tieneVoucherLegible: false,
  historialVouchers: 0,
  puedeSubirVoucher: false,
  puedeCambiarVoucher: false,
  vouchersPorMedio: [],
  progreso: undefined,
  ...extra,
});

const respuesta = {
  pedidos: [
    pedido({ id: '1', codigo: 'CP-W021', clienteNombre: 'María Quispe', mesaNombre: 'Mesa 3' }),
    pedido({ id: '2', codigo: 'CP-W022', clienteNombre: 'Juan Pérez', mesaNombre: 'Terraza 1', estado: 'PREPARANDO' }),
    pedido({ id: '3', codigo: 'CP-W023', clienteNombre: null, mesaNombre: 'Barra', modalidad: 'LOCAL' }),
  ],
  resumen: { cantidad: 3, total: 73.5, enCurso: 1, entregados: 2 },
};

const codigosVisibles = () =>
  screen.queryAllByText(/^CP-W\d{3}$/).map((el) => el.textContent);

describe('MisPedidosView: buscador en cliente', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('la caja de búsqueda tiene el placeholder pedido', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    expect(screen.getByPlaceholderText('Buscar por nombre, código o mesa')).toBeInTheDocument();
  });

  it('filtra por código sin importar mayúsculas ni el guion, y muestra el conteo', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, código o mesa'), { target: { value: 'cpw022' } });

    expect(codigosVisibles()).toEqual(['CP-W022']);
    expect(screen.getByText('1 resultado')).toBeInTheDocument();
  });

  it('filtra por nombre del cliente y por nombre de la mesa', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    const caja = screen.getByPlaceholderText('Buscar por nombre, código o mesa');

    fireEvent.change(caja, { target: { value: 'quispe' } });
    expect(codigosVisibles()).toEqual(['CP-W021']);

    fireEvent.change(caja, { target: { value: 'TERRAZA' } });
    expect(codigosVisibles()).toEqual(['CP-W022']);
  });

  it('sin coincidencias muestra el estado vacío con Limpiar, que devuelve la lista', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    const caja = screen.getByPlaceholderText('Buscar por nombre, código o mesa');

    fireEvent.change(caja, { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún pedido coincide con tu búsqueda')).toBeInTheDocument();
    expect(codigosVisibles()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(codigosVisibles()).toHaveLength(3));
    expect((caja as HTMLInputElement).value).toBe('');
  });

  it('se combina con el chip de estado', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');

    fireEvent.click(screen.getByRole('button', { name: 'Entregados' }));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, código o mesa'), { target: { value: 'juan' } });

    // Juan está en PREPARANDO: el chip Entregados lo deja fuera
    expect(codigosVisibles()).toEqual([]);
    expect(screen.getByText('Ningún pedido coincide con tu búsqueda')).toBeInTheDocument();
  });
});
