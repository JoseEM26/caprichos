import { describe, it, expect, vi, beforeEach } from 'vitest';
import { abrirTodas } from './abrirTodas';
import { filtrarComoServidor } from './filtrarComoServidor';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

// Los casos de la lista parten de la pestaña Lista (la inicial es Salón)
beforeEach(() => {
  localStorage.setItem('caprichos.misPedidos.pestana', 'lista');
});

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

const CAJA = 'Buscar por nombre, código o mesa';

describe('MisPedidosView: buscador en el servidor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    // Imita a la API: la búsqueda llega como q y el servidor devuelve solo las coincidencias
    vi.mocked(salonApi.misPedidos).mockImplementation((f: any) => Promise.resolve(filtrarComoServidor(respuesta, f)));
  });

  it('la caja de búsqueda tiene el placeholder pedido', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');
    expect(screen.getByPlaceholderText(CAJA)).toBeInTheDocument();
  });

  it('busca en el servidor 400 ms después de la última tecla y muestra el conteo', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');

    fireEvent.change(screen.getByPlaceholderText(CAJA), { target: { value: 'cpw022' } });
    expect(salonApi.misPedidos).not.toHaveBeenLastCalledWith(expect.objectContaining({ q: 'cpw022' }));

    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'cpw022' })));
    await waitFor(() => expect(codigosVisibles()).toEqual(['CP-W022']));
    expect(screen.getByText('1 resultado')).toBeInTheDocument();
  });

  it('filtra por código sin importar mayúsculas ni el guion', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');

    fireEvent.change(screen.getByPlaceholderText(CAJA), { target: { value: 'CP-W023' } });
    await waitFor(() => expect(codigosVisibles()).toEqual(['CP-W023']));
  });

  it('filtra por nombre del cliente y por nombre de la mesa', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');
    const caja = screen.getByPlaceholderText(CAJA);

    fireEvent.change(caja, { target: { value: 'quispe' } });
    await waitFor(() => expect(codigosVisibles()).toEqual(['CP-W021']));

    fireEvent.change(caja, { target: { value: 'TERRAZA' } });
    await waitFor(() => expect(codigosVisibles()).toEqual(['CP-W022']));
  });

  it('sin coincidencias muestra «No hay pedidos con estos filtros», con Limpiar filtros que devuelve la lista', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');
    const caja = screen.getByPlaceholderText(CAJA);

    fireEvent.change(caja, { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No hay pedidos con estos filtros')).toBeInTheDocument());
    expect(codigosVisibles()).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    await waitFor(() => expect(codigosVisibles()).toHaveLength(3));
    expect((caja as HTMLInputElement).value).toBe('');
  });

  it('se combina con el filtro de estado del panel de filtros avanzados', async () => {
    render(<MisPedidosView />);
    await abrirTodas('CP-W021');

    fireEvent.click(screen.getByRole('button', { name: /Filtros avanzados/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Entregados' }));
    fireEvent.change(screen.getByPlaceholderText(CAJA), { target: { value: 'juan' } });

    // Juan está en PREPARANDO: el filtro Entregados lo deja fuera
    await waitFor(() => expect(screen.getByText('No hay pedidos con estos filtros')).toBeInTheDocument());
    expect(codigosVisibles()).toEqual([]);
  });
});
