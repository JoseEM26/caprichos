import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '../../comun/api';
import { ReasignarVoucherBoton } from '../vouchers/ReasignarVoucherBoton';

const permisos = vi.hoisted(() => ({ lista: ['vouchers/ver', 'caja/ver'] as string[] }));

vi.mock('../../comun/socket', () => ({ useEventos: vi.fn() }));
vi.mock('../../comun/sesion', () => ({
  useSesion: () => ({
    tiene: (p: string) => permisos.lista.includes(p),
    usuario: { rol: 'CAJERO' },
  }),
}));

const destinos = {
  voucherId: '5',
  pedidoActual: { id: '1', codigo: 'CP-1' },
  bloqueado: false,
  destinos: [{ id: '2', codigo: 'CP-2', total: 20, medio: 'YAPE', creadoEn: new Date().toISOString() }],
};

describe('ReasignarVoucherBoton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    permisos.lista = ['vouchers/ver', 'caja/ver'];
  });

  it('sin permisos de caja no se muestra', () => {
    permisos.lista = ['vouchers/ver'];
    render(<ReasignarVoucherBoton voucherId="5" />);
    expect(screen.queryByText('Reasignar a otro pedido')).toBeNull();
  });

  it('lista los pedidos del mismo cliente y pide confirmación Sí/No antes de mover', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(destinos as any);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ ok: true } as any);
    const onReasignado = vi.fn();
    render(<ReasignarVoucherBoton voucherId="5" onReasignado={onReasignado} />);

    fireEvent.click(screen.getByText('Reasignar a otro pedido'));
    await waitFor(() => expect(screen.getByText('CP-2')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio'));
    fireEvent.click(screen.getByText('Mover voucher'));

    expect(post).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByText('Sí, mover voucher'));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/vouchers/5/reasignar', { pedidoId: '2' }));
    expect(onReasignado).toHaveBeenCalled();
  });

  it('muestra que un voucher ya usado para aprobar no se puede mover', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...destinos, bloqueado: true, destinos: [] } as any);
    render(<ReasignarVoucherBoton voucherId="5" />);
    fireEvent.click(screen.getByText('Reasignar a otro pedido'));
    expect(await screen.findByText(/ya aprobó un pago/)).toBeInTheDocument();
  });

  it('sin otro pedido candidato lo dice', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ ...destinos, destinos: [] } as any);
    render(<ReasignarVoucherBoton voucherId="5" />);
    fireEvent.click(screen.getByText('Reasignar a otro pedido'));
    expect(await screen.findByText(/No hay otro pedido de este cliente/)).toBeInTheDocument();
  });
});
