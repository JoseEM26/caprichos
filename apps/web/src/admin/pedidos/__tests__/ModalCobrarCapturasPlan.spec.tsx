import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { digitalesDelPlan, faltanCapturas } from '../mediosPago';

// Pago dividido con 2 medios digitales: el cobro exige una captura por cada uno (igual que el servidor).
const base: Pedido = {
  id: '90',
  codigo: 'CP-090',
  canal: 'MOZO',
  modalidad: 'MESA',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  total: '30.00',
  subtotal: '30.00',
  descuento: '0',
  creado_en: '2026-10-29T18:00:00Z',
  planPago: [
    { medio: 'YAPE', monto: '10.00' },
    { medio: 'PLIN', monto: '20.00' },
  ],
};

const voucher = (id: string, medio: 'YAPE' | 'PLIN' | null, semaforo: 'CONFIABLE' | 'ILEGIBLE' = 'CONFIABLE') => ({
  id,
  pedidoId: '90',
  archivoId: '900',
  origen: 'MOZO' as const,
  medio,
  semaforo,
  motivos: [],
  extraido: null,
  creadoEn: '2026-10-29T18:00:00Z',
});

describe('faltanCapturas (medios digitales del plan)', () => {
  it('un voucher sin medio cubre cualquiera; uno ILEGIBLE no cuenta', () => {
    expect(digitalesDelPlan([{ medio: 'EFECTIVO' }, { medio: 'YAPE' }, { medio: 'PLIN' }])).toEqual(['YAPE', 'PLIN']);
    expect(faltanCapturas(['YAPE', 'PLIN'], [{ medio: 'YAPE', semaforo: 'CONFIABLE' }])).toEqual(['PLIN']);
    expect(faltanCapturas(['YAPE', 'PLIN'], [{ medio: null, semaforo: 'CONFIABLE' }])).toEqual([]);
    expect(faltanCapturas(['YAPE'], [{ medio: 'YAPE', semaforo: 'ILEGIBLE' }])).toEqual(['YAPE']);
  });
});

describe('ModalCobrar con plan de 2 medios digitales', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra una fila por medio: la captura de Yape está, la de Plin falta, y NO bloquea el cobro (opcional)', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([voucher('1', 'YAPE')] as any);
    const cobrar = vi.fn().mockResolvedValue({});
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);

    await waitFor(() => expect(screen.getByTestId('captura-yape')).toHaveTextContent('captura subida'));
    expect(screen.getByTestId('captura-plin')).toHaveTextContent('falta');

    // La captura es opcional: el botón queda habilitado y el cobro sale como «sin captura»
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cobro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }, { timeout: 5000 }));
    await waitFor(() => expect(cobrar).toHaveBeenCalled());
    expect(cobrar.mock.calls[0][0].confirmaSinCaptura).toBe(true);
  });

  it('con una captura por medio, el cobro sale sin voucherId ni excepción (ya van enlazadas)', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      voucher('1', 'YAPE'),
      voucher('2', 'PLIN'),
    ] as any);
    const cobrar = vi.fn().mockResolvedValue({});
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);

    await waitFor(() => expect(screen.getByTestId('captura-plin')).toHaveTextContent('captura subida'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cobro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }, { timeout: 5000 }));

    await waitFor(() => expect(cobrar).toHaveBeenCalled());
    const dto = cobrar.mock.calls[0][0];
    expect(dto.voucherId).toBeUndefined();
    expect(dto.sinVoucher).toBeUndefined();
  });
});

describe('ModalCobrar sin captura (opcional en todos los canales)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pedido de mozo sin fotos: cobra sin casilla, sin motivo ni supervisor; viaja confirmaSinCaptura', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
    const cobrar = vi.fn().mockResolvedValue({});
    render(<ModalCobrar pedido={base} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);

    await screen.findByTestId('seccion-comprobante-cobro');
    expect(screen.queryByTestId('motivo-sin-voucher')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar cobro' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cobrar' }, { timeout: 5000 }));

    await waitFor(() => expect(cobrar).toHaveBeenCalled());
    const dto = cobrar.mock.calls[0][0];
    expect(dto.confirmaSinCaptura).toBe(true);
    expect(dto.sinVoucher).toBeUndefined();
  });

  it('delivery: también cobra sin captura, sin motivo ni código de supervisor', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([] as any);
    const cobrar = vi.fn().mockResolvedValue({});
    render(
      <ModalCobrar pedido={{ ...base, canal: 'CARTA', modalidad: 'DELIVERY' }} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />,
    );
    await screen.findByTestId('seccion-comprobante-cobro');
    expect(screen.queryByTestId('motivo-sin-voucher')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeEnabled();
  });
});
