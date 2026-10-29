import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BannerCajaCerrada, esperaCajaCerrada, EtiquetaCajaCerrada } from '../BannerCajaCerrada';
import { pedidosApi } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

function conPermisos(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Caja', rol: 'CAJERO' },
    permisos,
    debeCambiar: false,
    cargando: false,
    tiene: (p: string) => permisos.includes(p),
  } as any);
}

describe('Franja de caja cerrada', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('con la caja cerrada muestra la franja roja con el texto y el enlace a Caja y cierres', async () => {
    conPermisos(['caja/ver', 'caja/abrir']);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: false } as any);

    render(<BannerCajaCerrada />);

    expect(await screen.findByText('La caja está cerrada. Abre caja para cobrar y aprobar pagos.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Abrir caja' }).getAttribute('href')).toBe('/admin/cierre');
  });

  it('con la caja abierta no muestra nada', async () => {
    conPermisos(['caja/ver', 'caja/abrir']);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: true } as any);

    render(<BannerCajaCerrada />);

    await waitFor(() => expect(pedidosApi.obtenerCajaActual).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('quien no puede abrir caja (p. ej. mozo) no ve la franja', async () => {
    conPermisos(['caja/ver']);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockResolvedValue({ abierta: false } as any);

    render(<BannerCajaCerrada />);

    await waitFor(() => expect(pedidosApi.obtenerCajaActual).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('si el estado de caja no se puede leer, no muestra la franja', async () => {
    conPermisos(['caja/ver', 'caja/abrir']);
    vi.spyOn(pedidosApi, 'obtenerCajaActual').mockRejectedValue(new Error('red'));

    render(<BannerCajaCerrada />);

    await waitFor(() => expect(pedidosApi.obtenerCajaActual).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Etiqueta «Caja cerrada» en pedidos', () => {
  it('solo marca pedidos sin cobrar, no anulados, con la caja cerrada', () => {
    expect(esperaCajaCerrada({ estado: 'COLA', pago_estado: 'PENDIENTE' }, false)).toBe(true);
    expect(esperaCajaCerrada({ estado: 'COLA', pago_estado: 'PENDIENTE' }, true)).toBe(false);
    expect(esperaCajaCerrada({ estado: 'COLA', pago_estado: 'PENDIENTE' }, null)).toBe(false);
    expect(esperaCajaCerrada({ estado: 'COLA', pago_estado: 'PAGADO' }, false)).toBe(false);
    expect(esperaCajaCerrada({ estado: 'ANULADO', pago_estado: 'PENDIENTE' }, false)).toBe(false);
  });

  it('la etiqueta dice «Caja cerrada»', () => {
    render(<EtiquetaCajaCerrada />);
    expect(screen.getByText('Caja cerrada')).toBeTruthy();
  });
});
