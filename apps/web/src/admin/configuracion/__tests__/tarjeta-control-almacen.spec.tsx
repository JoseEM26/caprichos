import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaControlAlmacenConfiguracion } from '../TarjetaControlAlmacenConfiguracion';
import { AvisoControlAlmacen } from '../../stock/AvisoControlAlmacen';

const estado = (o: Partial<{ activo: boolean; insumosConReceta: number; insumosSinStock: number; productosEnRiesgo: number }> = {}) => ({
  activo: false,
  insumosConReceta: 12,
  insumosSinStock: 12,
  productosEnRiesgo: 8,
  ...o,
});

describe('Control de almacén (interruptor)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('el administrador ve «Apagado», confirma con aviso de productos en riesgo y guarda stock_control_activo', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estado());
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });

    render(<TarjetaControlAlmacenConfiguracion esAdmin />);
    expect(await screen.findByText('Apagado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Alternar control de almacén/ }));
    expect(screen.getByText(/8 productos se agotarán al primer cobro/)).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sí, confirmar/ }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/stock_control_activo', { valor: true }));
  });

  it('encendido, el administrador ve los dos ajustes de Cocina; apagado no se ve ninguno', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (u: string) =>
      u === '/admin/configuracion' ? ([{ clave: 'almacen_consumir_al_preparar', valor: 'no' }] as any) : (estado({ activo: true }) as any),
    );
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    const { unmount } = render(<TarjetaControlAlmacenConfiguracion esAdmin />);
    const caja = await screen.findByRole('checkbox', { name: /Descontar los insumos de Cocina/ });
    expect((caja as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('checkbox', { name: /Dejar que Cocina siga/ }) as HTMLInputElement).checked).toBe(true); // valor de fábrica
    fireEvent.click(caja);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/almacen_consumir_al_preparar', { valor: true }));
    unmount();

    get.mockImplementation(async () => estado({ activo: false }) as any);
    render(<TarjetaControlAlmacenConfiguracion esAdmin />);
    await screen.findByText('Apagado');
    expect(screen.queryByTestId('ajustes-cocina-almacen')).not.toBeInTheDocument();
  });

  it('No, cancelar no cambia nada', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estado());
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });

    render(<TarjetaControlAlmacenConfiguracion esAdmin />);
    await screen.findByText('Apagado');
    fireEvent.click(screen.getByRole('button', { name: /Alternar control de almacén/ }));
    fireEvent.click(screen.getByRole('button', { name: /No, cancelar/ }));
    expect(put).not.toHaveBeenCalled();
  });

  it('quien no es administrador no ve el botón', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(estado());
    render(<TarjetaControlAlmacenConfiguracion esAdmin={false} />);
    await screen.findByText('Apagado');
    expect(screen.queryByRole('button', { name: /Alternar control de almacén/ })).not.toBeInTheDocument();
    expect(screen.getByText('Solo ADMIN')).toBeInTheDocument();
  });

  it('el aviso aparece en las pantallas de almacén solo cuando el control está apagado', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue(estado({ activo: false }));
    const { unmount } = render(<AvisoControlAlmacen />);
    expect(await screen.findByTestId('aviso-control-almacen')).toBeInTheDocument();
    unmount();

    get.mockResolvedValue(estado({ activo: true }));
    render(<AvisoControlAlmacen />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('aviso-control-almacen')).not.toBeInTheDocument();
  });
});
