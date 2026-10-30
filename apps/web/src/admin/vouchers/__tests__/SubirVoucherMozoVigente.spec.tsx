import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubirVoucherMozo } from '../SubirVoucherMozo';
import { vouchersApi, type ItemHistorialVoucher } from '../vouchersApi';
import * as reducirModulo from '../reducirImagenVoucher';

const vigente: ItemHistorialVoucher = {
  id: 'v1', subidoEn: '2026-10-30T15:00:00Z', subidoPor: 'Ana P.', medio: 'YAPE', estado: 'VIGENTE',
  reemplazadoEn: null, motivoCambio: null, legible: true, semaforo: 'CONFIABLE', archivoId: '9',
};

describe('SubirVoucherMozo: voucher actual, comparación y anteriores', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (a) => a);
  });

  it('muestra el voucher actual al abrir y ofrece «Cambiar voucher»', async () => {
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({ items: [vigente] });
    render(<SubirVoucherMozo pedidoId="7" medio="YAPE" alVoucherValido={vi.fn()} />);
    await screen.findByText('Voucher actual');
    expect(screen.getByText(/por Ana P\./)).toBeTruthy();
    expect(screen.queryByTestId('btn-tomar-voucher')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar voucher' }));
    expect(screen.getByTestId('btn-tomar-voucher')).toBeTruthy();
  });

  it('confirma con Antes/Nuevo y motivo, sube y luego lista los anteriores', async () => {
    const hist = vi
      .spyOn(vouchersApi, 'historialPedido')
      .mockResolvedValueOnce({ items: [vigente] })
      .mockResolvedValue({
        items: [
          { ...vigente, id: 'v2', estado: 'VIGENTE', archivoId: '10' },
          { ...vigente, estado: 'REEMPLAZADO', reemplazadoEn: '2026-10-30T16:00:00Z', motivoCambio: 'Captura correcta' },
        ],
      });
    const subir = vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v2', legible: true } as any);
    render(<SubirVoucherMozo pedidoId="7" medio="YAPE" alVoucherValido={vi.fn()} />);
    await screen.findByText('Voucher actual');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar voucher' }));
    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'n.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByTestId('comparar-voucher');
    expect(screen.getByText('Antes')).toBeTruthy();
    expect(screen.getByText('Nuevo')).toBeTruthy();
    expect(subir).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Motivo del cambio/), { target: { value: 'Captura correcta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(subir).toHaveBeenCalledWith(expect.anything(), '7', 'YAPE', 'Captura correcta'));
    await waitFor(() => expect(hist).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Ver vouchers anteriores (1)' }));
    await screen.findByText('Motivo: Captura correcta');
  });
});
