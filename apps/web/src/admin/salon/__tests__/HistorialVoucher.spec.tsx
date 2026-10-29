import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HistorialVoucher } from '../HistorialVoucher';
import { vouchersApi } from '../../vouchers/vouchersApi';

describe('HistorialVoucher', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('va plegado y no pide nada hasta desplegar (carga perezosa)', () => {
    const spy = vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({ items: [] });
    render(<HistorialVoucher pedidoId="50" total={2} />);
    expect(screen.getByRole('button', { name: 'Historial del voucher (2)' })).toBeDefined();
    expect(screen.queryByText(/Vigente|Reemplazado/)).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('al desplegar carga el historial: vigente y reemplazado con motivo, sin semáforo para el mozo', async () => {
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({
      items: [
        {
          id: '200',
          subidoEn: '2026-10-29T15:10:00Z',
          subidoPor: 'Ana P.',
          medio: 'YAPE',
          estado: 'VIGENTE',
          reemplazadoEn: null,
          motivoCambio: 'Foto nueva',
          legible: true,
        },
        {
          id: '100',
          subidoEn: '2026-10-29T15:00:00Z',
          subidoPor: 'Ana P.',
          medio: 'YAPE',
          estado: 'REEMPLAZADO',
          reemplazadoEn: '2026-10-29T15:10:00Z',
          motivoCambio: null,
          legible: false,
        },
      ],
    });
    render(<HistorialVoucher pedidoId="50" total={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial del voucher (2)' }));

    expect(await screen.findByText('Vigente')).toBeDefined();
    expect(screen.getByText('Reemplazado')).toBeDefined();
    expect(screen.getByText('Motivo: Foto nueva')).toBeDefined();
    expect(screen.getByText('No se lee')).toBeDefined();
    expect(screen.queryByText(/Semáforo/)).toBeNull();
    expect(vouchersApi.historialPedido).toHaveBeenCalledWith('50');
  });

  it('muestra el semáforo cuando el servidor lo envía (Caja y Admin)', async () => {
    vi.spyOn(vouchersApi, 'historialPedido').mockResolvedValue({
      items: [
        {
          id: '9',
          subidoEn: '2026-10-29T15:10:00Z',
          subidoPor: null,
          medio: 'PLIN',
          estado: 'VIGENTE',
          reemplazadoEn: null,
          motivoCambio: null,
          legible: true,
          semaforo: 'CONFIABLE',
          archivoId: '900',
        },
      ],
    });
    render(<HistorialVoucher pedidoId="50" total={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial del voucher (1)' }));
    expect(await screen.findByText('Semáforo: CONFIABLE')).toBeDefined();
  });

  it('muestra un aviso si el historial no carga', async () => {
    vi.spyOn(vouchersApi, 'historialPedido').mockRejectedValue(new Error('x'));
    render(<HistorialVoucher pedidoId="50" total={2} />);
    fireEvent.click(screen.getByRole('button', { name: 'Historial del voucher (2)' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo cargar'));
  });
});
