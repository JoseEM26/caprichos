import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';
import { vouchersApi } from '../../vouchers/vouchersApi';

vi.mock('../../../comun/sesion', () => ({ useSesion: () => ({ tiene: () => true }) }));
vi.mock('../api', () => ({
  salonApi: { misPedidos: vi.fn(), obtenerMesas: vi.fn() },
}));
vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({
  ModalNuevoPedidoMesa: () => null,
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn(), enviarACaja: vi.fn() },
}));

const pedido = (extra: Record<string, unknown>) => ({
  id: '1',
  estado: 'PREPARANDO',
  modalidad: 'MESA',
  mesaNombre: 'Mesa 3',
  total: 24.5,
  pagoEstado: 'PENDIENTE',
  pagoMetodo: null,
  creadoEn: '2026-10-29T15:10:00Z',
  lineas: [{ nombre: 'Café', cantidad: 2 }],
  vouchers: 0,
  tieneVoucherLegible: false,
  ...extra,
});

const respuesta = {
  pedidos: [
    pedido({ id: '12', codigo: 'CP-M012' }),
    pedido({ id: '13', codigo: 'CP-M013', estado: 'ENTREGADO' }),
    pedido({ id: '14', codigo: 'CP-M014', estado: 'ANULADO' }),
    pedido({ id: '15', codigo: 'CP-M015', pagoEstado: 'PAGADO' }),
    pedido({ id: '16', codigo: 'CP-D016', modalidad: 'DELIVERY', mesaNombre: null }),
  ],
  resumen: { cantidad: 5, total: 122.5, enCurso: 1, entregados: 1 },
};

const tarjetaDe = (codigo: string) => screen.getByText(codigo).closest('li') as HTMLElement;

describe('MisPedidosView: Enviar a Caja (solo pedidos de mesa abiertos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('el botón Enviar a Caja aparece solo en mesa, no anulada, no entregada y no cobrada', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    expect(screen.getAllByRole('button', { name: 'Enviar a Caja' })).toHaveLength(1);
    expect(within(tarjetaDe('CP-M012')).getByRole('button', { name: 'Enviar a Caja' })).toBeInTheDocument();
    for (const codigo of ['CP-M013', 'CP-M014', 'CP-M015', 'CP-D016']) {
      expect(within(tarjetaDe(codigo)).queryByRole('button', { name: 'Enviar a Caja' })).toBeNull();
    }
  });

  it('abre la precuenta de la mesa y envía el cobro a Caja con el medio elegido', async () => {
    vi.mocked(vouchersApi.enviarACaja).mockResolvedValue({ ok: true });
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    fireEvent.click(within(tarjetaDe('CP-M012')).getByRole('button', { name: 'Enviar a Caja' }));

    const precuenta = await screen.findByRole('dialog', { name: 'Precuenta' });
    expect(within(precuenta).getByText('Mesa 3')).toBeInTheDocument();
    expect(within(precuenta).getByText('S/ 24.50')).toBeInTheDocument();

    fireEvent.click(within(precuenta).getByRole('button', { name: 'Yape' }));
    fireEvent.click(within(precuenta).getByTestId('btn-enviar-caja'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, enviar a Caja' }));

    await waitFor(() =>
      expect(vouchersApi.enviarACaja).toHaveBeenCalledWith('12', 'YAPE', [{ medio: 'YAPE', monto: 24.5 }]),
    );
  });
});
