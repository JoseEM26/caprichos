import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeccionVouchersPedido } from '../SeccionVouchersPedido';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { obtenerBlobAutenticado } from '../../../comun/api';

vi.mock('../../../comun/api', async (importOriginal) => {
  const real: any = await importOriginal();
  return { ...real, obtenerBlobAutenticado: vi.fn().mockResolvedValue('blob:foto-voucher') };
});

describe('SeccionVouchersPedido: reemplazo tardío de Caja con motivo y confirmación', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(obtenerBlobAutenticado).mockResolvedValue('blob:foto-voucher');
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      { id: '21', pedidoId: '77', archivoId: '900', origen: 'MOZO', medio: 'YAPE', semaforo: 'CONFIABLE', motivos: [], extraido: null, creadoEn: '2026-10-27T18:00:00Z' } as any,
    ]);
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({ items: [] });
  });

  it('no deja continuar sin motivo de al menos 5 caracteres y pide confirmación Sí/No antes de la foto', async () => {
    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);
    await screen.findByText('Comprobantes del pedido (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar voucher' }));
    const continuar = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement;
    expect(continuar.disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'mal' } });
    expect((screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'La foto estaba borrosa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByRole('button', { name: 'Sí, reemplazar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'No' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(screen.queryByRole('button', { name: 'Sí, reemplazar' })).toBeNull();
  });

  it('el historial de Caja va plegado debajo de los comprobantes', async () => {
    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);
    await screen.findByText('Comprobantes del pedido (1)');
    expect(screen.getByRole('button', { name: 'Historial del voucher' })).toBeDefined();
    expect(vouchersApi.historialPedido).not.toHaveBeenCalled();
  });
});
