import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import * as sesionModulo from '../../../comun/sesion';
import { TarjetaAyudaIaConfiguracion } from '../TarjetaAyudaIaConfiguracion';

describe('TarjetaAyudaIaConfiguracion (Ola J - Tarjeta en Configuración)', () => {
  const sesionAdmin = {
    usuario: { partyId: '1', nombres: 'Admin Test', rol: 'ADMIN' },
    permisos: ['configuracion/ver', 'configuracion/editar'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: () => true,
  };

  const sesionCajero = {
    usuario: { partyId: '2', nombres: 'Cajero Test', rol: 'CAJERO' },
    permisos: ['caja/ver'],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: () => false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionAdmin);
  });

  it('1. renderiza la tarjeta con el interruptor y métricas de consumo de IA para ADMIN', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'ayuda_ia_activo', valor: false }];
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 15,
          tokensEntrada: 4500,
          tokensSalida: 1200,
          tokensTotal: 5700,
          costoUsdEstimado: 0.8542,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 4.3,
          topeAlcanzado: false,
          iaActiva: true,
        };
      }
      return [];
    });

    render(<TarjetaAyudaIaConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-ayuda-ia')).toBeInTheDocument();
    });

    expect(screen.getByText('Asistente de ayuda con IA')).toBeInTheDocument();
    expect(screen.getByText('Desactivado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alternar Asistente de ayuda con IA/i })).toHaveTextContent(
      'Activar',
    );
    expect(screen.getByText(/Consumo de la IA este mes \(2026-10\)/i)).toBeInTheDocument();
    expect(screen.getByText(/15 consultas/i)).toBeInTheDocument();
    expect(screen.getByText(/5,700 tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.8542 USD/i)).toBeInTheDocument();
    expect(screen.getByText(/Yo solo te guío/i)).toBeInTheDocument();
  });

  it('2. abre diálogo de confirmación Sí/No antes de cambiar el estado del asistente', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'ayuda_ia_activo', valor: false }];
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 0,
          tokensEntrada: 0,
          tokensSalida: 0,
          tokensTotal: 0,
          costoUsdEstimado: 0,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 0,
          topeAlcanzado: false,
          iaActiva: false,
        };
      }
      return [];
    });

    render(<TarjetaAyudaIaConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-ayuda-ia')).toBeInTheDocument();
    });

    const botonActivar = screen.getByRole('button', { name: /Alternar Asistente de ayuda con IA/i });
    fireEvent.click(botonActivar);

    // Debe mostrarse el modal de confirmación
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('¿Activar Asistente de ayuda con IA?')).toBeInTheDocument();
    expect(screen.getByText('Sí, activar')).toBeInTheDocument();
    expect(screen.getByText('No, cancelar')).toBeInTheDocument();

    // Cancelar cierra el diálogo
    fireEvent.click(screen.getByText('No, cancelar'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('3. al confirmar Sí, envía PUT /admin/configuracion/ayuda_ia_activo y actualiza a Activado', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'ayuda_ia_activo', valor: false }];
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 0,
          tokensEntrada: 0,
          tokensSalida: 0,
          tokensTotal: 0,
          costoUsdEstimado: 0,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 0,
          topeAlcanzado: false,
          iaActiva: true,
        };
      }
      return [];
    });

    const spyPut = vi.spyOn(api, 'put').mockResolvedValueOnce({
      clave: 'ayuda_ia_activo',
      valor: true,
    });

    render(<TarjetaAyudaIaConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-ayuda-ia')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Alternar Asistente de ayuda con IA/i }));
    fireEvent.click(screen.getByText('Sí, activar'));

    await waitFor(() => {
      expect(spyPut).toHaveBeenCalledWith('/admin/configuracion/ayuda_ia_activo', {
        valor: true,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Activado')).toBeInTheDocument();
      expect(screen.getByText(/Asistente de ayuda con IA activado/i)).toBeInTheDocument();
    });
  });

  it('4. un usuario sin rol ADMIN no puede alternar el interruptor (solo ADMIN)', async () => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue(sesionCajero);

    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'ayuda_ia_activo', valor: true }];
      }
      return [];
    });

    render(<TarjetaAyudaIaConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-ayuda-ia')).toBeInTheDocument();
    });

    // No debe existir el botón interactivo de alternar
    expect(
      screen.queryByRole('button', { name: /Alternar Asistente de ayuda con IA/i }),
    ).not.toBeInTheDocument();

    // Debe mostrar la etiqueta Solo ADMIN
    expect(screen.getByText('Solo ADMIN')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /Solo el Administrador puede activar o desactivar el asistente de ayuda con IA/i,
    );
  });

  it('5. muestra estado "Tope alcanzado" cuando el consumo del mes excede el presupuesto', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'ayuda_ia_activo', valor: true }];
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 300,
          tokensEntrada: 120000,
          tokensSalida: 45000,
          tokensTotal: 165000,
          costoUsdEstimado: 20.45,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 102.3,
          topeAlcanzado: true,
          iaActiva: false,
        };
      }
      return [];
    });

    render(<TarjetaAyudaIaConfiguracion />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-ayuda-ia')).toBeInTheDocument();
    });

    expect(screen.getByText('Tope alcanzado')).toBeInTheDocument();
    expect(screen.getByText(/102\.3% consumido/i)).toBeInTheDocument();
  });
});
