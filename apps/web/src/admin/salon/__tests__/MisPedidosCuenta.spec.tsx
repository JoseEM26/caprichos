import { describe, it, expect, vi, beforeEach } from 'vitest';
import { abrirTodas } from './abrirTodas';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MisPedidosView } from '../MisPedidosView';
import { salonApi } from '../api';

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
  estado: 'PREPARANDO',
  modalidad: 'MESA',
  mesaNombre: 'Mesa 3',
  clienteNombre: 'Ana',
  total: 30,
  pagoEstado: 'PAGADO',
  pagoMetodo: null,
  creadoEn: '2026-10-29T15:10:00Z',
  lineas: [{ nombre: 'Café', cantidad: 1 }],
  vouchers: 0,
  tieneVoucherLegible: false,
  historialVouchers: 0,
  puedeSubirVoucher: false,
  puedeCambiarVoucher: false,
  vouchersPorMedio: [],
  ...extra,
});

const respuesta = {
  pedidos: [
    pedido({ id: '22', codigo: 'CP-W122', total: 4, estado: 'COLA', pagoEstado: 'PENDIENTE', pedidoOrigenId: '20', pedidoOrigenCodigo: 'CP-W120' }),
    pedido({ id: '21', codigo: 'CP-W121', total: 6, estado: 'LISTO', pagoEstado: 'PENDIENTE', pedidoOrigenId: '20', pedidoOrigenCodigo: 'CP-W120' }),
    pedido({ id: '20', codigo: 'CP-W120', total: 30 }),
    pedido({ id: '5', codigo: 'CP-W105', clienteNombre: 'Luis', mesaNombre: 'Barra', total: 12 }),
  ],
  resumen: { cantidad: 4, total: 52, enCurso: 4, entregados: 0 },
};

describe('Mis pedidos: una tarjeta por cuenta (original + extras)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('original + 2 extras en UNA tarjeta con los 3 códigos y el total de la cuenta; el suelto sigue aparte', async () => {
    render(<MisPedidosView />);
    await abrirTodas();
    const cuenta = screen.getByTestId('tarjeta-cuenta');
    expect(screen.getAllByTestId('tarjeta-cuenta')).toHaveLength(1);
    for (const c of ['CP-W120', 'CP-W121', 'CP-W122']) expect(within(cuenta).getByText(c)).toBeTruthy();
    expect(within(cuenta).getByTestId('rotulo-original')).toHaveTextContent('PEDIDO ORIGINAL');
    expect(within(cuenta).getAllByTestId('insignia-extra')).toHaveLength(2);
    expect(within(cuenta).getByTestId('total-cuenta')).toHaveTextContent('Total de la cuenta: S/ 40.00');
    expect(within(cuenta).getByTestId('total-cuenta')).toHaveTextContent('Por cobrar S/ 10.00');
    expect(screen.getByText('CP-W105')).toBeTruthy();
    // El resumen sigue contando cada pedido
    expect(screen.getByText('Pedidos').previousSibling).toHaveTextContent('4');
  });

  it('buscar por el código de un extra encuentra la cuenta y marca los que no coinciden', async () => {
    render(<MisPedidosView />);
    await screen.findByTestId('tarjeta-cuenta');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, código o mesa'), { target: { value: 'cpw122' } });
    const cuenta = screen.getByTestId('tarjeta-cuenta');
    expect(within(cuenta).getByText('CP-W120')).toBeTruthy();
    expect(within(cuenta).getAllByTestId('fuera-filtro')).toHaveLength(2);
    expect(screen.queryByText('CP-W105')).toBeNull();
    expect(screen.getByText('1 resultado')).toBeTruthy();
  });

  it('sin extras una tarjeta es la de siempre', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({ pedidos: [respuesta.pedidos[3]], resumen: { cantidad: 1, total: 12, enCurso: 1, entregados: 0 } } as any);
    render(<MisPedidosView />);
    await abrirTodas('CP-W105');
    expect(screen.queryByTestId('tarjeta-cuenta')).toBeNull();
  });

  it('acordeón: cerrada por defecto con varias cuentas pendientes, sin listar extras; abre y cierra con aria-expanded', async () => {
    render(<MisPedidosView />);
    await screen.findAllByRole('button', { name: /Ana/ });
    const cabs = document.querySelectorAll<HTMLElement>('.mp-acc-cab');
    expect(cabs).toHaveLength(2);
    cabs.forEach((c) => expect(c.getAttribute('aria-expanded')).toBe('false'));
    expect(screen.queryAllByTestId('insignia-extra')).toHaveLength(0);
    expect(within(cabs[0]).getByText('2 extras')).toBeTruthy();
    fireEvent.click(cabs[0]);
    expect(cabs[0].getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(cabs[0].getAttribute('aria-controls')!)).not.toBeNull();
    expect(screen.getAllByTestId('insignia-extra')).toHaveLength(2);
    fireEvent.click(cabs[0]);
    expect(screen.queryAllByTestId('insignia-extra')).toHaveLength(0);
  });

  it('acordeón: si una sola cuenta tiene algo pendiente, arranca abierta', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({ pedidos: [respuesta.pedidos[3]], resumen: { cantidad: 1, total: 12, enCurso: 1, entregados: 0 } } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-W105');
    expect(document.querySelector('.mp-acc-cab')!.getAttribute('aria-expanded')).toBe('true');
  });
});
