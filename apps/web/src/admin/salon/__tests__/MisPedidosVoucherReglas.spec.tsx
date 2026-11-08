import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  vouchersApi: { subirVoucher: vi.fn(), enviarACaja: vi.fn(), guardarPlanPago: vi.fn(), historialPedido: vi.fn() },
}));

const pedido = (extra: Record<string, unknown>) => ({
  id: '1',
  codigo: 'CP-W021',
  estado: 'PREPARANDO',
  modalidad: 'LLEVAR',
  mesaNombre: null,
  total: 27,
  pagoEstado: 'PENDIENTE',
  pagoMetodo: 'YAPE',
  plan: [
    { medio: 'EFECTIVO', monto: 17 },
    { medio: 'PLIN', monto: 10 },
  ],
  montoDigital: 10,
  creadoEn: '2026-10-29T15:10:00Z',
  lineas: [{ nombre: 'Torta', cantidad: 1 }],
  vouchers: 1,
  tieneVoucherLegible: true,
  historialVouchers: 1,
  vouchersPorMedio: [{ medio: 'PLIN', monto: 10, subido: true }],
  puedeCambiarVoucher: false,
  puedeSubirVoucher: false,
  ...extra,
});

const tarjeta = (codigo: string) => screen.getByText(codigo).closest('li') as HTMLElement;

describe('MisPedidosView: reglas del voucher en la tarjeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
  });

  it('pedido en cocina con voucher subido: no ofrece Cambiar voucher y muestra la nota', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [pedido({})],
      resumen: { cantidad: 1, total: 27, enCurso: 1, entregados: 0 },
    } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    const card = tarjeta('CP-W021');
    expect(card.textContent).toContain('Voucher Plin: subido');
    expect(card.textContent).toContain('Voucher bloqueado: Caja ya aprobó el pago de este pedido. Pide a Caja cualquier cambio.');
    expect(Array.from(card.querySelectorAll('button')).some((b) => b.textContent === 'Cambiar voucher')).toBe(false);
  });

  it('muestra un voucher por medio: el que falta ofrece Subir voucher mientras el servidor lo permita', async () => {
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [
        pedido({
          id: '2',
          codigo: 'CP-W022',
          estado: 'COLA',
          pagoMetodo: 'PLIN',
          plan: [
            { medio: 'YAPE', monto: 10 },
            { medio: 'PLIN', monto: 7 },
            { medio: 'EFECTIVO', monto: 10 },
          ],
          vouchersPorMedio: [
            { medio: 'YAPE', monto: 10, subido: true },
            { medio: 'PLIN', monto: 7, subido: false },
          ],
          puedeCambiarVoucher: true,
          puedeSubirVoucher: true,
          historialVouchers: 1,
          vouchers: 1,
        }),
      ],
      resumen: { cantidad: 1, total: 27, enCurso: 1, entregados: 0 },
    } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-W022');
    const card = tarjeta('CP-W022');
    expect(card.textContent).toContain('Voucher Yape: subido');
    expect(card.textContent).toContain('Voucher Plin: falta');
    const botones = Array.from(card.querySelectorAll('button')).map((b) => b.textContent);
    expect(botones).toContain('Cambiar voucher');
    expect(botones).toContain('Subir voucher');
  });
});

describe('MisPedidosView: quitar voucher desde la tarjeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
  });

  it('con pago pendiente ofrece Quitar voucher y lo pide con confirmación', async () => {
    const { vouchersApi } = await import('../../vouchers/vouchersApi');
    const quitar = vi.fn().mockResolvedValue({ ok: true });
    (vouchersApi as any).quitarVoucher = quitar;
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [
        pedido({
          id: '3',
          codigo: 'CP-W025',
          estado: 'COLA',
          pagoMetodo: 'PLIN',
          plan: [{ medio: 'PLIN', monto: 17 }],
          vouchersPorMedio: [{ medio: 'PLIN', monto: 17, subido: true, voucherId: '555' }],
          puedeCambiarVoucher: true,
          puedeSubirVoucher: true,
          historialVouchers: 1,
          vouchers: 1,
        }),
      ],
      resumen: { cantidad: 1, total: 27, enCurso: 1, entregados: 0 },
    } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-W025');
    const card = tarjeta('CP-W025');
    fireEvent.click(Array.from(card.querySelectorAll('button')).find((b) => b.textContent === 'Quitar voucher')!);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
    await waitFor(() => expect(quitar).toHaveBeenCalledWith('555'));
  });
});

describe('MisPedidosView: nombre del cliente y filtro Falta captura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue({
      pedidos: [
        pedido({
          id: '1',
          codigo: 'CP-W021',
          clienteNombre: 'Ana López',
          modalidad: 'LLEVAR',
          mesaNombre: null,
          plan: [{ medio: 'PLIN', monto: 10 }],
          vouchersPorMedio: [{ medio: 'PLIN', monto: 10, subido: false }],
          puedeSubirVoucher: true,
          puedeCambiarVoucher: false,
          vouchers: 0,
          tieneVoucherLegible: false,
          historialVouchers: 0,
        }),
        pedido({
          id: '2',
          codigo: 'CP-W022',
          clienteNombre: 'Luis Ruiz',
          modalidad: 'LLEVAR',
          mesaNombre: null,
          plan: [{ medio: 'YAPE', monto: 10 }],
          vouchersPorMedio: [{ medio: 'YAPE', monto: 10, subido: true, voucherId: '9' }],
          puedeSubirVoucher: false,
          puedeCambiarVoucher: true,
          vouchers: 1,
          tieneVoucherLegible: true,
          historialVouchers: 1,
        }),
        pedido({
          id: '3',
          codigo: 'CP-W023',
          estado: 'ANULADO',
          clienteNombre: 'Eva Mora',
          modalidad: 'LLEVAR',
          mesaNombre: null,
          plan: [{ medio: 'YAPE', monto: 10 }],
          vouchersPorMedio: [{ medio: 'YAPE', monto: 10, subido: false }],
          puedeSubirVoucher: true,
          puedeCambiarVoucher: false,
          vouchers: 0,
          tieneVoucherLegible: false,
          historialVouchers: 0,
        }),
      ],
      resumen: { cantidad: 3, total: 81, enCurso: 2, entregados: 0 },
    } as any);
  });

  it('muestra el nombre del cliente junto al código, en una sola línea con ellipsis', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    const nombre = screen.getByText('Ana López', { exact: false });
    expect(nombre.className).toContain('mpv-cliente');
    expect(nombre.getAttribute('title')).toBe('Ana López');
  });

  it('la opción Falta captura del combo Estado cuenta los no anulados sin voucher vigente y filtra solo esos', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-W021');
    // El filtro Estado es un combo; la opción «Falta captura» lleva la cantidad
    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    expect(screen.getByRole('option', { name: /Falta captura/ })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('option', { name: /Falta captura/ }));
    expect(screen.getByRole('button', { name: 'Estado: Falta captura' })).toBeInTheDocument();

    expect(screen.getByText('CP-W021')).toBeDefined();
    expect(screen.queryByText('CP-W022')).toBeNull();
    expect(screen.queryByText('CP-W023')).toBeNull();
    expect(screen.getByText('Falta captura (opcional)', { selector: '.mpv-insignia-falta' })).toBeDefined();
    expect(screen.getByText('CP-W021').closest('li')!.className).toContain('mpv-card--falta');
  });
});
