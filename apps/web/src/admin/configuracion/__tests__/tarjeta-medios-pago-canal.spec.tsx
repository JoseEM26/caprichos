import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { TarjetaMediosPagoCanal } from '../TarjetaMediosPagoCanal';

describe('Medios de pago por canal (Configuración)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('por defecto todo encendido salvo Pago en línea, en los 4 canales', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ canales: undefined });
    render(<TarjetaMediosPagoCanal esAdmin />);
    const yape = await screen.findByRole('switch', { name: 'Yape en Carta web' });
    expect((yape as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('switch', { name: 'Plin en WhatsApp' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('switch', { name: 'Pago en línea en Caja' }) as HTMLInputElement).checked).toBe(false);
  });

  it('apagar un medio pide confirmación Sí/No y guarda la tabla completa', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ canales: undefined });
    const put = vi.spyOn(api, 'put').mockResolvedValue({ ok: true });
    render(<TarjetaMediosPagoCanal esAdmin />);
    fireEvent.click(await screen.findByRole('switch', { name: 'Plin en Mozo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar medios de pago' }));
    expect(put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(put).toHaveBeenCalled());
    const [ruta, cuerpo] = put.mock.calls[0] as [string, { valor: any }];
    expect(ruta).toBe('/admin/configuracion/medios_pago_canal');
    expect(cuerpo.valor.MOZO.PLIN).toBe(false);
    expect(cuerpo.valor.CARTA.PLIN).toBe(true);
  });

  it('no deja apagar todo en Caja: avisa y bloquea el guardado; en otros canales sí', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ canales: undefined });
    render(<TarjetaMediosPagoCanal esAdmin />);
    for (const m of ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia']) {
      fireEvent.click(await screen.findByRole('switch', { name: `${m} en Carta web` }));
    }
    expect((screen.getByRole('button', { name: 'Guardar medios de pago' }) as HTMLButtonElement).disabled).toBe(false);
    for (const m of ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia']) {
      fireEvent.click(screen.getByRole('switch', { name: `${m} en Caja` }));
    }
    expect(screen.getByText('Caja necesita al menos un medio de pago encendido.')).toBeInTheDocument();
    expect((screen.getByRole('button', { name: 'Guardar medios de pago' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('quien no es ADMIN ve la tabla sin poder cambiarla', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ canales: undefined });
    render(<TarjetaMediosPagoCanal esAdmin={false} />);
    expect((await screen.findByRole('switch', { name: 'Yape en Caja' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Guardar medios de pago' })).toBeNull();
  });
});
