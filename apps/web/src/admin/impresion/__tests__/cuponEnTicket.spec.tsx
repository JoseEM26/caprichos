import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { CuponEnTicket } from '../CuponEnTicket';

describe('Imprimir cupón en el ticket', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('apagado por defecto; al marcarlo guarda SI', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    render(<CuponEnTicket puedeEditar />);
    const caja = (await screen.findByLabelText('Imprimir cupón en el ticket')) as HTMLInputElement;
    expect(caja.checked).toBe(false);
    fireEvent.click(caja);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/impresion_cupon_en_ticket', { valor: 'SI' }));
    await waitFor(() => expect(caja.checked).toBe(true));
  });

  it('encendido se puede apagar (NO) y sin permiso queda deshabilitado', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([{ clave: 'impresion_cupon_en_ticket', valor: 'SI' }]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const { unmount } = render(<CuponEnTicket puedeEditar />);
    const caja = (await screen.findByLabelText('Imprimir cupón en el ticket')) as HTMLInputElement;
    expect(caja.checked).toBe(true);
    fireEvent.click(caja);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/impresion_cupon_en_ticket', { valor: 'NO' }));
    unmount();
    render(<CuponEnTicket puedeEditar={false} />);
    expect(((await screen.findByLabelText('Imprimir cupón en el ticket')) as HTMLInputElement).disabled).toBe(true);
  });
});
