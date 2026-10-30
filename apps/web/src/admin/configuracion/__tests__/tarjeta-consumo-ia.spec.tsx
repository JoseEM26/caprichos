import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { ParametrosOperacionTab } from '../ParametrosOperacionTab';

describe('Tarjeta de consumo de IA en Configuración del local (Ola 3, Agente G)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. renderiza la tarjeta de consumo de IA con consultas, tokens, costo estimado y porcentaje', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [
          { clave: 'chatbot_ia_activo', valor: 'si' },
          { clave: 'chatbot_ia_tope_mensual_usd', valor: 20 },
          { clave: 'chatbot_ia_max_por_hora_telefono', valor: 10 },
        ];
      }
      if (ruta === '/admin/reclamos/whatsapp/estado-conexion') {
        return { conectado: true, modo: 'meta' };
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 42,
          tokensEntrada: 18500,
          tokensSalida: 6200,
          tokensTotal: 24700,
          costoUsdEstimado: 3.4567,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 17.3,
          topeAlcanzado: false,
          iaActiva: true,
        };
      }
      return [];
    });

    render(<ParametrosOperacionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-consumo-ia')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Consumo de la IA este mes \(2026-10\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/42 consultas/i)).toBeInTheDocument();
    expect(screen.getByText(/24,700 tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/\$3\.4567 USD/i)).toBeInTheDocument();
    expect(screen.getByText(/Tope: \$20\.00 USD/i)).toBeInTheDocument();
    expect(screen.getByText(/17\.3% consumido/i)).toBeInTheDocument();
    expect(screen.getByText('IA activa')).toBeInTheDocument();
  });

  it('2. muestra estado "Tope alcanzado" cuando el consumo supera o iguala el tope mensual', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [{ clave: 'chatbot_ia_activo', valor: 'si' }];
      }
      if (ruta === '/admin/reclamos/whatsapp/estado-conexion') {
        return { conectado: false, modo: 'simulado' };
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return {
          periodo: '2026-10',
          llamadasTotal: 180,
          tokensEntrada: 85000,
          tokensSalida: 45000,
          tokensTotal: 130000,
          costoUsdEstimado: 20.12,
          topeMensualUsd: 20.0,
          porcentajeConsumido: 100,
          topeAlcanzado: true,
          iaActiva: false,
        };
      }
      return [];
    });

    render(<ParametrosOperacionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(screen.getByTestId('tarjeta-consumo-ia')).toBeInTheDocument();
    });

    expect(screen.getByText('Tope alcanzado')).toBeInTheDocument();
  });

  it('3. muestra los 3 nuevos parámetros de IA con sus nombres descriptivos y tipos', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/configuracion') {
        return [
          { clave: 'chatbot_ia_activo', valor: 'no' },
          { clave: 'chatbot_ia_tope_mensual_usd', valor: 20 },
          { clave: 'chatbot_ia_max_por_hora_telefono', valor: 10 },
        ];
      }
      if (ruta === '/admin/reclamos/whatsapp/estado-conexion') {
        return { conectado: false, modo: 'simulado' };
      }
      if (ruta === '/admin/configuracion/ia-consumo') {
        return null;
      }
      return [];
    });

    render(<ParametrosOperacionTab puedeVer={true} puedeEditar={true} />);

    await waitFor(() => {
      expect(
        screen.getByText(/Chatbot: Inteligencia Artificial para dudas \(OpenAI\)/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Chatbot: Tope mensual de gasto en IA \(USD\)/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Chatbot: Límite de consultas a la IA por hora y teléfono/i),
      ).toBeInTheDocument();
    });
  });
});
