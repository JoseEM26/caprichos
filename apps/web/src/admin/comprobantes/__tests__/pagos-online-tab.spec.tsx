import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { culqiApi } from '../../../carta/pagos/culqiApi';
import { PagosOnlineTab } from '../PagosOnlineTab';

const pago = { id: 'g1', pedidoCodigo: 'A1', monto: 25, medio: 'YAPE', estado: 'APROBADO', culqiId: 'chr_1', creadoEn: '2026-01-01T15:00:00Z', devuelto: false };
const comoRol = (rol: string) =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1', nombres: 'T', rol }, permisos: [], tiene: () => true } as any);

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(culqiApi, 'listar').mockResolvedValue({ items: [pago], total: 1 });
});

describe('Pagos en línea (admin)', () => {
  it('ADMIN devuelve con motivo y confirmación', async () => {
    comoRol('ADMIN');
    const dev = vi.spyOn(culqiApi, 'devolver').mockResolvedValue({} as any);
    render(<PagosOnlineTab />);
    fireEvent.click(await screen.findByRole('button', { name: 'Devolver' }));
    const ok = screen.getByRole('button', { name: 'Sí, devolver' }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Error de cobro' } });
    fireEvent.click(ok);
    await waitFor(() => expect(dev).toHaveBeenCalledWith('g1', { motivo: 'Error de cobro', medio: 'CULQI', confirmar: true }));
  });

  it('otros roles no ven Devolver', async () => {
    comoRol('SUPERVISOR');
    render(<PagosOnlineTab />);
    await screen.findByText('#A1');
    expect(screen.queryByRole('button', { name: 'Devolver' })).toBeNull();
  });

  it('devolución parcial por otro medio y saldo restante', async () => {
    comoRol('ADMIN');
    vi.spyOn(culqiApi, 'listar').mockResolvedValue({ items: [{ ...pago, montoDevuelto: 10, cobroPendiente: true }], total: 1 });
    const dev = vi.spyOn(culqiApi, 'devolver').mockResolvedValue({} as any);
    render(<PagosOnlineTab />);
    expect((await screen.findByText(/Devuelto S\/ 10.00 de S\/ 25.00/))).toBeTruthy();
    expect(screen.getByTestId('cobro-pendiente').textContent).toMatch(/falta registrar en Caja/);
    fireEvent.click(screen.getByRole('button', { name: 'Devolver' }));
    fireEvent.change(screen.getByLabelText(/Monto a devolver/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Medio de devolución/), { target: { value: 'YAPE' } });
    expect(screen.getByText(/solo se registra lo que ya devolviste/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Cliente' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, devolver' }));
    await waitFor(() => expect(dev).toHaveBeenCalledWith('g1', { motivo: 'Cliente', medio: 'YAPE', monto: 5, confirmar: true }));
  });
});
