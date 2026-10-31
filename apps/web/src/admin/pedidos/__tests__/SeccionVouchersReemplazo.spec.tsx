import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionVouchersPedido } from '../SeccionVouchersPedido';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';
import { obtenerBlobAutenticado } from '../../../comun/api';

vi.mock('../../../comun/api', async (importOriginal) => {
  const real: any = await importOriginal();
  return { ...real, obtenerBlobAutenticado: vi.fn().mockResolvedValue('blob:foto-voucher') };
});

const vigente = {
  id: 'v1', subidoEn: '2026-10-30T15:00:00Z', subidoPor: 'Ana P.', medio: 'YAPE', estado: 'VIGENTE',
  reemplazadoEn: null, motivoCambio: null, legible: true, semaforo: 'CONFIABLE', archivoId: '900',
};

describe('SeccionVouchersPedido: reemplazo de Caja con una sola pregunta de motivo', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(obtenerBlobAutenticado).mockResolvedValue('blob:foto-voucher');
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (a) => a);
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      { id: '21', pedidoId: '77', archivoId: '900', origen: 'MOZO', medio: 'YAPE', semaforo: 'CONFIABLE', motivos: [], extraido: null, creadoEn: '2026-10-27T18:00:00Z' } as any,
    ]);
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({ items: [vigente] } as any);
  });

  it('«Reemplazar voucher» ya no pide motivo ni confirmación antes de elegir la foto', async () => {
    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);
    await screen.findByText('Comprobantes del pedido (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar voucher' }));

    expect(screen.getByRole('button', { name: 'Yape' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Continuar' })).toBeNull();
    expect(screen.queryByLabelText(/Motivo del cambio/)).toBeNull();
    expect(await screen.findByTestId('btn-tomar-voucher')).toBeTruthy();
  });

  it('con la foto elegida muestra Antes/Nuevo y pregunta el motivo UNA sola vez; sube con ese motivo', async () => {
    const subir = vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({ id: 'v2', legible: true } as any);
    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);
    await screen.findByText('Comprobantes del pedido (1)');
    fireEvent.click(screen.getByRole('button', { name: 'Reemplazar voucher' }));

    fireEvent.change(await screen.findByTestId('input-voucher-archivo'), {
      target: { files: [new File(['v'], 'n.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByTestId('comparar-voucher');
    expect(screen.getAllByLabelText(/Motivo del cambio/)).toHaveLength(1);

    // El «Sí, cambiar» no avanza sin motivo; con un motivo rápido sí
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));
    expect(subir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'El cliente envió el voucher correcto por WhatsApp' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(subir).toHaveBeenCalledWith(expect.anything(), '77', 'YAPE', 'El cliente envió el voucher correcto por WhatsApp'));
  });

  it('el historial de Caja va plegado debajo de los comprobantes', async () => {
    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);
    await screen.findByText('Comprobantes del pedido (1)');
    expect(screen.getByRole('button', { name: 'Historial del voucher' })).toBeDefined();
  });
});
