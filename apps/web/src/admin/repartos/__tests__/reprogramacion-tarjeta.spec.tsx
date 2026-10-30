import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TarjetaReparto } from '../TarjetaReparto';
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

const pedidoRetirado = (extra: Record<string, unknown> = {}) =>
  ({
    id: '601',
    codigo: 'CP-0601',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    cliente_nombre: 'Marta',
    cliente_telefono: '987654321',
    direccion: 'Jr. Las Flores 10',
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
    ...extra,
  }) as any;

describe('Reprogramación en la tarjeta del admin', () => {
  beforeEach(() => {
    vi.mocked(repartosApi.reprogramarPedido).mockClear();
  });

  it('pedido Por reprogramar: muestra el estado y el botón Reprogramar / Reenviar a reparto', () => {
    render(
      <TarjetaReparto
        pedido={pedidoRetirado({ reprogramacion: 'POR_REPROGRAMAR' })}
        puedeLiquidar
        alActualizar={() => {}}
      />,
    );

    expect(screen.getByText(/Por reprogramar: el cliente confirmó/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).toBeInTheDocument();
  });

  it('el botón pide confirmación Sí/No y solo al confirmar llama al reenvío', async () => {
    const alActualizar = vi.fn();
    render(
      <TarjetaReparto
        pedido={pedidoRetirado({ reprogramacion: 'POR_REPROGRAMAR' })}
        puedeLiquidar
        alActualizar={alActualizar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar / Reenviar a reparto' }));
    expect(repartosApi.reprogramarPedido).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, confirmar' }));

    await waitFor(() => expect(repartosApi.reprogramarPedido).toHaveBeenCalledWith('601'));
    await waitFor(() => expect(alActualizar).toHaveBeenCalled());
  });

  it('sin permiso de liquidar no ofrece el botón', () => {
    render(
      <TarjetaReparto pedido={pedidoRetirado({ reprogramacion: 'POR_REPROGRAMAR' })} alActualizar={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).toBeNull();
  });

  it('pedido reenviado en Para elegir: muestra la marca Reprogramado y no el botón', () => {
    render(
      <TarjetaReparto
        pedido={pedidoRetirado({ motivo_falla: null, reprogramado: true })}
        esDisponible
        puedeLiquidar
        alActualizar={() => {}}
      />,
    );
    expect(screen.getByText('Reprogramado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reprogramar / Reenviar a reparto' })).toBeNull();
  });
});
