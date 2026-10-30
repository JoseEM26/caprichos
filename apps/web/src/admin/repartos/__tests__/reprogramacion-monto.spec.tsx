import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaReparto, etiquetaReprogramar, textoRecargoReprog } from '../TarjetaReparto';
import { repartosApi } from '../repartosApi';

vi.mock('../repartosApi', async (importOriginal) => {
  const real: any = await importOriginal();
  return {
    ...real,
    repartosApi: {
      ...real.repartosApi,
      reprogramarPedido: vi.fn().mockResolvedValue({ ok: true, pedido: {} }),
      consultarMensajes: vi.fn().mockResolvedValue([]),
    },
  };
});

const pedidoPorReprogramar = (extra: Record<string, unknown> = {}) =>
  ({
    id: '701',
    codigo: 'CP-0701',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Rosa',
    cliente_telefono: '987654321',
    direccion: 'Jr. Lima 5',
    referencia: null,
    lat: -12.05,
    lng: -77.04,
    zona: null,
    zona_id: null,
    minutosEspera: 0,
    color: 'verde',
    total: 30,
    pago_estado: 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    cobro_pendiente_efectivo: false,
    paga_con: null,
    repartidor_party_id: null,
    tomado_en: null,
    salio_en: null,
    llego_en: null,
    entregado_en: null,
    motivo_falla: 'NO_CONTESTA',
    creado_en: new Date().toISOString(),
    reprogramacion: 'POR_REPROGRAMAR',
    ...extra,
  }) as any;

describe('Helpers del botón de reenvío', () => {
  it('muestra el monto exacto del reenvío', () => {
    expect(etiquetaReprogramar(7)).toBe('Reprogramar / Reenviar a reparto: S/ 7.00');
    expect(etiquetaReprogramar(0)).toBe('Reprogramar / Reenviar a reparto (sin costo)');
    expect(etiquetaReprogramar(null)).toBe('Reprogramar / Reenviar a reparto');
  });

  it('la confirmación dice cuánto se suma, o que no tiene recargo', () => {
    expect(textoRecargoReprog(7)).toContain('S/ 7.00');
    expect(textoRecargoReprog(0)).toBe('No tiene recargo.');
  });
});

describe('Tarjeta de Caja: Por reprogramar con el monto', () => {
  beforeEach(() => {
    vi.mocked(repartosApi.reprogramarPedido).mockClear();
  });

  it('el botón muestra el recargo que se cobra al reenviar', () => {
    render(
      <TarjetaReparto pedido={pedidoPorReprogramar({ recargoReprogramacion: 7 })} puedeLiquidar alActualizar={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto: S/ 7.00' })).toBeInTheDocument();
  });

  it('la confirmación del reenvío repite el monto antes de Sí/No', async () => {
    render(
      <TarjetaReparto pedido={pedidoPorReprogramar({ recargoReprogramacion: 7 })} puedeLiquidar alActualizar={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reprogramar \/ Reenviar a reparto/ }));
    expect(screen.getByText(/Se suma un recargo de S\/ 7\.00 al total y al envío del pedido/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sí/ }));
    await waitFor(() => {
      expect(repartosApi.reprogramarPedido).toHaveBeenCalledWith('701');
    });
  });
});
