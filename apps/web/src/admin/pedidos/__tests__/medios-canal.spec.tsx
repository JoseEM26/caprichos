import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { api } from '../../../comun/api';
import { PlanPagoEditor } from '../../salon/componentes/PlanPagoEditor';

const props = { total: 20, filas: [{ medio: 'EFECTIVO' as const, monto: '20.00' }], onChange: vi.fn(), pagaCon: '', onPagaCon: vi.fn() };

describe('Caja y mozo ocultan los medios apagados', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('el mozo no ve Plin si está apagado en MOZO', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ medios: ['EFECTIVO', 'YAPE', 'TARJETA', 'TRANSFERENCIA'] });
    render(<PlanPagoEditor {...props} canal="MOZO" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Plin' })).toBeNull());
    expect(get).toHaveBeenCalledWith('/admin/medios-pago/MOZO');
    expect(screen.getByRole('button', { name: 'Yape' })).toBeInTheDocument();
  });

  it('Caja pide los medios de CAJA', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ medios: ['EFECTIVO'] });
    render(<PlanPagoEditor {...props} canal="CAJA" />);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Yape' })).toBeNull());
    expect(get).toHaveBeenCalledWith('/admin/medios-pago/CAJA');
  });

  it('respeta el orden configurado y marca la insignia; grande solo resalta', async () => {
    const presentacion = { TRANSFERENCIA: { orden: 1, tamano: 'normal', insignia: null }, YAPE: { orden: 2, tamano: 'grande', insignia: 'Al toque' } };
    vi.spyOn(api, 'get').mockResolvedValue({ medios: ['TRANSFERENCIA', 'YAPE', 'EFECTIVO'], presentacion });
    render(<PlanPagoEditor {...props} canal="CAJA" />);
    await waitFor(() => expect(screen.getByTestId('insignia-medio').textContent).toBe('Al toque'));
    const nombres = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => /Transferencia|Yape|Efectivo/.test(t));
    expect(nombres[0]).toContain('Transferencia');
    expect(nombres[1]).toContain('Yape');
    expect(nombres[2]).toContain('Efectivo');
    expect(screen.getByRole('button', { name: /Yape/ }).style.border).toContain('2px');
  });
});
