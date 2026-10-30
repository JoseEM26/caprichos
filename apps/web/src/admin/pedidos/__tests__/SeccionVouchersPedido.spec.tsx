import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SeccionVouchersPedido } from '../SeccionVouchersPedido';
import { vouchersApi } from '../../vouchers/vouchersApi';
import { obtenerBlobAutenticado } from '../../../comun/api';

vi.mock('../../../comun/api', async (importOriginal) => {
  const real: any = await importOriginal();
  return { ...real, obtenerBlobAutenticado: vi.fn().mockResolvedValue('blob:foto-voucher') };
});

// Caja y mensajes: todas las fotos del pedido (de cualquier origen), con su lectura informativa.
describe('SeccionVouchersPedido', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(obtenerBlobAutenticado).mockResolvedValue('blob:foto-voucher');
  });

  it('muestra las fotos enlazadas al pedido con su lectura (origen carta o mozo)', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      {
        id: '21',
        pedidoId: '77',
        archivoId: '900',
        origen: 'CARTA',
        medio: 'YAPE',
        semaforo: 'OBSERVADO',
        motivos: ['El destino no coincide'],
        extraido: null,
        creadoEn: '2026-10-27T18:00:00Z',
      } as any,
    ]);

    render(<SeccionVouchersPedido pedidoId="77" total="35.00" medio="YAPE" />);

    expect(await screen.findByText('Comprobantes del pedido (1)')).toBeDefined();
    expect(await screen.findByAltText('Foto del comprobante')).toBeDefined();
    expect(screen.getByTestId('tarjeta-lectura-voucher')).toBeDefined();
    expect(vouchersApi.listarVouchers).toHaveBeenCalledWith({ pedidoId: '77', estado: 'todos' });
  });

  it('sin fotos no muestra nada', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);
    render(<SeccionVouchersPedido pedidoId="77" />);

    await waitFor(() => {
      expect(vouchersApi.listarVouchers).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('seccion-vouchers-pedido')).toBeNull();
  });

  it('sin permiso (403) no muestra nada y no rompe la pantalla', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockRejectedValue(new Error('403'));
    render(<SeccionVouchersPedido pedidoId="77" />);

    await waitFor(() => {
      expect(vouchersApi.listarVouchers).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('seccion-vouchers-pedido')).toBeNull();
  });
});
