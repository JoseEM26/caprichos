import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
vi.mock('../../../comun/socket', () => ({
  useEventos: vi.fn(),
}));
vi.mock('../componentes/ModalNuevoPedidoMesa', () => ({
  ModalNuevoPedidoMesa: () => null,
}));
vi.mock('../../vouchers/vouchersApi', () => ({
  vouchersApi: { subirVoucher: vi.fn(), enviarACaja: vi.fn(), quitarVoucher: vi.fn() },
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

describe('MisPedidosView: sin Enviar a Caja (la cuenta de mesa se cobra desde Mesas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('ningún pedido de mesa abierto muestra el botón Enviar a Caja', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    expect(screen.queryByRole('button', { name: 'Enviar a Caja' })).toBeNull();
    for (const codigo of ['CP-M012', 'CP-M013', 'CP-M014', 'CP-M015', 'CP-D016']) {
      expect(within(tarjetaDe(codigo)).queryByRole('button', { name: 'Enviar a Caja' })).toBeNull();
    }
  });
});
