import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SeccionVouchersCierre } from '../SeccionVouchersCierre';
import { vouchersApi } from '../vouchersApi';
import * as apiModulo from '../../../comun/api';

describe('SeccionVouchersCierre (Cierre de Caja - Vouchers digitales del día)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const vouchersMock = [
    {
      id: 'vch-1',
      archivoId: 'arch-10',
      origen: 'MOZO' as const,
      medio: 'YAPE' as const,
      semaforo: 'CONFIABLE' as const,
      motivos: ['Monto coincide'],
      extraido: {
        legible: true,
        monto: 38.5,
        moneda: 'PEN',
        operacion: '11223344',
        fecha: '2026-10-27',
        hora: '16:00',
        titular: 'Maria Jose M.',
        destinoNumero: '977503006',
        medioDetectado: 'YAPE' as const,
        confianza: 0.95,
      },
      revisadoEn: null,
      creadoEn: '2026-10-27T16:00:00Z',
    },
    {
      id: 'vch-2',
      archivoId: 'arch-20',
      origen: 'WHATSAPP' as const,
      medio: 'PLIN' as const,
      semaforo: 'OBSERVADO' as const,
      motivos: ['Monto menor'],
      extraido: {
        legible: true,
        monto: 25.0,
        moneda: 'PEN',
        operacion: '55667788',
        fecha: '2026-10-27',
        hora: '17:00',
        titular: 'Maria Jose M.',
        destinoNumero: '977503006',
        medioDetectado: 'PLIN' as const,
        confianza: 0.85,
      },
      revisadoEn: '2026-10-27T17:30:00Z',
      creadoEn: '2026-10-27T17:00:00Z',
    },
  ];

  it('lista los vouchers del día con miniatura, semáforo, datos y contador de pendientes', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue(vouchersMock);
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:img-url');

    render(<SeccionVouchersCierre fecha="2026-10-27" puedeVer={true} />);

    await waitFor(() => {
      expect(screen.getByText('Vouchers digitales del día')).toBeDefined();
    });

    // Contador de pendientes (1 pendiente, 1 revisado)
    expect(screen.getByText('Faltan revisar: 1 voucher')).toBeDefined();

    // Comprobar que avisa que no bloquea el cierre
    expect(screen.getByText(/No bloquea el cierre de caja/i)).toBeDefined();

    // Datos del primer voucher
    expect(screen.getByText(/S\/ 38.50/i)).toBeDefined();
    expect(screen.getByText(/Confiable/i)).toBeDefined();
    expect(screen.getByText(/Op: 11223344/i)).toBeDefined();

    // Estado del segundo voucher (ya revisado)
    expect(screen.getByText(/S\/ 25.00/i)).toBeDefined();
    expect(screen.getByText(/Observado/i)).toBeDefined();
    expect(screen.getByText('Revisado')).toBeDefined();
  });

  it('el botón "Marcar revisado" abre diálogo Confirmar Sí/No y actualiza el estado', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([vouchersMock[0]]);
    vi.spyOn(vouchersApi, 'marcarRevisado').mockResolvedValue({
      ok: true,
      id: 'vch-1',
      revisadoEn: '2026-10-27T18:00:00Z',
    });
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:img-url');

    render(<SeccionVouchersCierre fecha="2026-10-27" puedeVer={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-marcar-revisado-vch-1')).toBeDefined();
    });

    const btnMarcar = screen.getByTestId('btn-marcar-revisado-vch-1');
    fireEvent.click(btnMarcar);

    // Diálogo de confirmación Sí/No
    expect(screen.getByText('¿Marcar voucher como revisado?')).toBeDefined();

    const btnConfirmar = screen.getByText('Sí, marcar revisado');
    fireEvent.click(btnConfirmar);

    await waitFor(() => {
      expect(vouchersApi.marcarRevisado).toHaveBeenCalledWith('vch-1');
    });

    await waitFor(() => {
      expect(screen.getByText('Revisado')).toBeDefined();
      expect(screen.getByText('Todos los vouchers revisados (1)')).toBeDefined();
    });
  });

  it('muestra mensaje amigable cuando no hay vouchers en el turno', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);

    render(<SeccionVouchersCierre fecha="2026-10-27" puedeVer={true} />);

    await waitFor(() => {
      expect(
        screen.getByText('No hay vouchers digitales registrados en este turno.'),
      ).toBeDefined();
    });
  });
});
