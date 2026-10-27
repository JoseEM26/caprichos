import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaVouchersIaConfiguracion } from '../TarjetaVouchersIaConfiguracion';
import { vouchersApi } from '../../vouchers/vouchersApi';

describe('TarjetaVouchersIaConfiguracion (Panel de Administración > Configuración)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const configMock = {
    voucher_ia_activo: false,
    voucher_titular_nombre: 'Kevin',
    voucher_yape_numero: '946388934',
    voucher_plin_numero: '946388934',
    voucher_mozo_obligatorio: true,
  };

  const consumoMock = {
    periodo: '2026-10',
    llamadasTotal: 42,
    tokensEntrada: 15000,
    tokensSalida: 2500,
    tokensTotal: 17500,
    costoUsdEstimado: 0.045,
    topeMensualUsd: 20.0,
    porcentajeConsumido: 0,
    topeAlcanzado: false,
    iaActiva: true,
  };

  it('1. renderiza la tarjeta con estado Desactivado, titular y números para ADMIN', async () => {
    vi.spyOn(vouchersApi, 'obtenerConfiguracion').mockResolvedValue(configMock);
    vi.spyOn(vouchersApi, 'obtenerConsumoIa').mockResolvedValue(consumoMock);

    render(<TarjetaVouchersIaConfiguracion esAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByText('Lectura de vouchers con IA')).toBeDefined();
    });

    expect(screen.getByText('Desactivado')).toBeDefined();
    expect(screen.getByTestId('btn-toggle-vouchers-ia')).toBeDefined();

    // Valores en inputs
    const inputTitular = screen.getByTestId('input-voucher-titular') as HTMLInputElement;
    expect(inputTitular.value).toBe('Kevin');

    const inputYape = screen.getByTestId('input-voucher-yape') as HTMLInputElement;
    expect(inputYape.value).toBe('946388934');

    const inputPlin = screen.getByTestId('input-voucher-plin') as HTMLInputElement;
    expect(inputPlin.value).toBe('946388934');

    // Consumo del mes y sin tope
    expect(screen.getByText('Sin tope mensual')).toBeDefined();
    expect(screen.getByText(/42 lecturas/i)).toBeDefined();
  });

  it('2. abre diálogo de confirmación Sí/No antes de alternar el interruptor con IA', async () => {
    vi.spyOn(vouchersApi, 'obtenerConfiguracion').mockResolvedValue(configMock);
    vi.spyOn(vouchersApi, 'obtenerConsumoIa').mockResolvedValue(consumoMock);

    render(<TarjetaVouchersIaConfiguracion esAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-toggle-vouchers-ia')).toBeDefined();
    });

    const btnToggle = screen.getByTestId('btn-toggle-vouchers-ia');
    fireEvent.click(btnToggle);

    // Diálogo Confirmar Sí/No
    expect(screen.getByText('¿Activar lectura de vouchers con IA?')).toBeDefined();
    expect(screen.getByText('Sí, activar')).toBeDefined();
    expect(screen.getByText('No, cancelar')).toBeDefined();
  });

  it('3. al confirmar Sí, envía PUT para activar y actualiza el estado a Activado', async () => {
    vi.spyOn(vouchersApi, 'obtenerConfiguracion').mockResolvedValue(configMock);
    vi.spyOn(vouchersApi, 'obtenerConsumoIa').mockResolvedValue(consumoMock);
    const spyGuardar = vi
      .spyOn(vouchersApi, 'guardarParametro')
      .mockResolvedValue({ ok: true });

    render(<TarjetaVouchersIaConfiguracion esAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('btn-toggle-vouchers-ia')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('btn-toggle-vouchers-ia'));

    const btnSi = screen.getByText('Sí, activar');
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(spyGuardar).toHaveBeenCalledWith('voucher_ia_activo', true);
    });

    await waitFor(() => {
      expect(screen.getByText('Activado')).toBeDefined();
    });
  });

  it('4. permite editar titular y números y exige Confirmar Sí/No al guardar', async () => {
    vi.spyOn(vouchersApi, 'obtenerConfiguracion').mockResolvedValue(configMock);
    vi.spyOn(vouchersApi, 'obtenerConsumoIa').mockResolvedValue(consumoMock);
    const spyGuardar = vi
      .spyOn(vouchersApi, 'guardarParametro')
      .mockResolvedValue({ ok: true });

    render(<TarjetaVouchersIaConfiguracion esAdmin={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('input-voucher-titular')).toBeDefined();
    });

    const inputTitular = screen.getByTestId('input-voucher-titular');
    fireEvent.change(inputTitular, { target: { value: 'Kevin Ramos' } });

    const btnGuardar = screen.getByTestId('btn-guardar-campos-vouchers');
    fireEvent.click(btnGuardar);

    // Diálogo Confirmar Sí/No
    expect(
      screen.getByText('¿Guardar cambios de configuración de vouchers?'),
    ).toBeDefined();

    const btnSi = screen.getByText('Sí, guardar cambios');
    fireEvent.click(btnSi);

    await waitFor(() => {
      expect(spyGuardar).toHaveBeenCalledWith(
        'voucher_titular_nombre',
        'Kevin Ramos',
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Parámetros de vouchers actualizados correctamente'),
      ).toBeDefined();
    });
  });

  it('5. un usuario sin rol ADMIN ve advertencia y los controles quedan deshabilitados', async () => {
    vi.spyOn(vouchersApi, 'obtenerConfiguracion').mockResolvedValue(configMock);
    vi.spyOn(vouchersApi, 'obtenerConsumoIa').mockResolvedValue(consumoMock);

    render(<TarjetaVouchersIaConfiguracion esAdmin={false} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Solo el Administrador puede modificar/i),
      ).toBeDefined();
    });

    expect(screen.queryByTestId('btn-toggle-vouchers-ia')).toBeNull();
    expect(screen.getByText('Solo ADMIN')).toBeDefined();

    const inputTitular = screen.getByTestId('input-voucher-titular') as HTMLInputElement;
    expect(inputTitular.disabled).toBe(true);
  });
});
