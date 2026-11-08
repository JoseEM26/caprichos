import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { api } from '../../../comun/api';
import { PrioridadTickets } from '../PrioridadTickets';

describe('Imprimir primero los tickets de pago', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sin valor guardado aparece marcado; al quitarlo guarda ORDEN_LLEGADA', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    render(<PrioridadTickets puedeEditar />);
    const caja = (await screen.findByLabelText('Imprimir primero los tickets de pago')) as HTMLInputElement;
    expect(caja.checked).toBe(true);
    fireEvent.click(caja);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/impresion_prioridad', { valor: 'ORDEN_LLEGADA' }));
    await waitFor(() => expect(caja.checked).toBe(false));
  });

  it('con ORDEN_LLEGADA guardado aparece sin marcar y se puede volver a marcar', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([{ clave: 'impresion_prioridad', valor: 'ORDEN_LLEGADA' }]);
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    render(<PrioridadTickets puedeEditar />);
    const caja = (await screen.findByLabelText('Imprimir primero los tickets de pago')) as HTMLInputElement;
    expect(caja.checked).toBe(false);
    fireEvent.click(caja);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/admin/configuracion/impresion_prioridad', { valor: 'TICKETS_PRIMERO' }));
  });

  it('sin permiso de editar queda deshabilitado', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    render(<PrioridadTickets puedeEditar={false} />);
    expect(((await screen.findByLabelText('Imprimir primero los tickets de pago')) as HTMLInputElement).disabled).toBe(true);
  });
});
