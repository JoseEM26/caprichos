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
  vouchersApi: { subirVoucher: vi.fn(), guardarPlanPago: vi.fn().mockResolvedValue({ ok: true }) },
}));
vi.mock('../../vouchers/reducirImagenVoucher', () => ({
  reducirImagenVoucher: vi.fn(async (archivo: File) => archivo),
}));

// Mismos campos que devuelve misPedidos: un voucher por medio digital y la regla del servidor
const pedido = (extra: Record<string, unknown>) => {
  const base = {
    estado: 'ENTREGADO',
    modalidad: 'MESA',
    mesaNombre: 'Mesa 3',
    total: 24.5,
    pagoEstado: 'PENDIENTE',
    creadoEn: '2026-10-29T15:10:00Z',
    lineas: [{ nombre: 'Café', cantidad: 2 }],
    pagoMetodo: null as string | null,
    vouchers: 0,
    tieneVoucherLegible: false,
    historialVouchers: 0,
    puedeSubirVoucher: true,
    puedeCambiarVoucher: true,
    ...extra,
  };
  const digital = ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(String(base.pagoMetodo));
  return {
    ...base,
    vouchersPorMedio: digital ? [{ medio: base.pagoMetodo, monto: base.total, subido: base.tieneVoucherLegible }] : [],
  };
};

const respuesta = {
  pedidos: [
    pedido({ id: '12', codigo: 'CP-M012', pagoMetodo: 'YAPE' }),
    pedido({ id: '11', codigo: 'CP-M011', pagoMetodo: 'EFECTIVO', estado: 'PREPARANDO' }),
    pedido({ id: '10', codigo: 'CP-M010', pagoMetodo: 'TRANSFERENCIA', estado: 'ANULADO' }),
  ],
  resumen: { cantidad: 2, total: 24.5, enCurso: 0, entregados: 1 },
};

/** Tarjeta (li) del pedido por su código */
const tarjetaDe = (codigo: string) => screen.getByText(codigo).closest('li') as HTMLElement;

describe('MisPedidosView: voucher de pedidos digitales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(salonApi.obtenerMesas).mockResolvedValue({ pisos: [] });
    vi.mocked(salonApi.misPedidos).mockResolvedValue(respuesta as any);
  });

  it('el botón Subir voucher solo aparece en pagos digitales y no anulados', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    const botones = screen.getAllByRole('button', { name: 'Subir voucher' });
    expect(botones).toHaveLength(1);
    expect(within(tarjetaDe('CP-M012')).getByRole('button', { name: 'Subir voucher' })).toBeInTheDocument();
    expect(within(tarjetaDe('CP-M012')).getByText('Voucher Yape: falta')).toBeInTheDocument();
    expect(within(tarjetaDe('CP-M011')).queryByText(/Voucher (Yape|Plin|Transferencia):/)).not.toBeInTheDocument();
    expect(within(tarjetaDe('CP-M010')).queryByText(/Voucher (Yape|Plin|Transferencia):/)).not.toBeInTheDocument();
  });

  it('abre la ventana del voucher con el medio del pedido', async () => {
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');

    fireEvent.click(screen.getByRole('button', { name: 'Subir voucher' }));

    const dialogo = await screen.findByRole('dialog', { name: 'Voucher del pedido CP-M012' });
    expect(within(dialogo).getByText('Foto del voucher (YAPE)')).toBeInTheDocument();
  });

  it('tras subir una foto legible muestra el éxito y vuelve a leer la lista', async () => {
    vi.mocked(vouchersApi.subirVoucher).mockResolvedValue({ id: '7', legible: true } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');
    fireEvent.click(screen.getByRole('button', { name: 'Subir voucher' }));

    const input = await screen.findByTestId('input-voucher-archivo');
    fireEvent.change(input, {
      target: { files: [new File(['img'], 'yape.jpg', { type: 'image/jpeg' })] },
    });

    expect(await screen.findByText(/Voucher guardado/)).toBeInTheDocument();
    await waitFor(() => expect(salonApi.misPedidos).toHaveBeenCalledTimes(2));
    expect(vouchersApi.subirVoucher).toHaveBeenCalledWith(expect.anything(), '12', 'YAPE');
  });

  it('si la foto no se lee pide otra y no recarga la lista', async () => {
    vi.mocked(vouchersApi.subirVoucher).mockResolvedValue({
      id: '8',
      legible: false,
      mensaje: 'Este voucher no se lee bien. Vuelve a tomar la foto, por favor.',
    } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');
    fireEvent.click(screen.getByRole('button', { name: 'Subir voucher' }));

    const input = await screen.findByTestId('input-voucher-archivo');
    fireEvent.change(input, {
      target: { files: [new File(['img'], 'yape.jpg', { type: 'image/jpeg' })] },
    });

    expect(await screen.findByTestId('voucher-mozo-ilegible')).toHaveTextContent('no se lee bien');
    expect(screen.queryByText(/Voucher guardado/)).not.toBeInTheDocument();
    expect(salonApi.misPedidos).toHaveBeenCalledTimes(1);
  });

  it('el mozo no ve semáforo, motivos ni datos extraídos', async () => {
    // Aunque la API devolviera la respuesta completa, el mozo solo ve legible / no legible
    vi.mocked(vouchersApi.subirVoucher).mockResolvedValue({
      id: '9',
      legible: true,
      semaforo: 'OBSERVADO',
      motivos: ['Monto menor al pedido'],
      extraido: { monto: 10, operacion: '123456' },
    } as any);
    render(<MisPedidosView />);
    await screen.findByText('CP-M012');
    fireEvent.click(screen.getByRole('button', { name: 'Subir voucher' }));

    const input = await screen.findByTestId('input-voucher-archivo');
    fireEvent.change(input, {
      target: { files: [new File(['img'], 'yape.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByText(/Voucher guardado/);

    const texto = document.body.textContent ?? '';
    expect(texto).not.toMatch(/OBSERVADO|CONFIABLE|RARO|SIN_LECTURA|Monto menor|123456|sem[aá]foro/i);
  });
});
