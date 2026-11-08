import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';

let permisos: string[] = ['pedidos/extra'];
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario: null }),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const pedido = (extra: Partial<Pedido> = {}) =>
  ({ id: '1', codigo: 'CP-W045', canal: 'CAJA', modalidad: 'MESA', estado: 'ENTREGADO', pago_estado: 'PAGADO', subtotal: 20, descuento: 0, total: 20, lineas: [], ...extra }) as unknown as Pedido;

const ver = (p: Pedido, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={() => {}} alAgregarExtra={() => {}} {...props} />
    </MemoryRouter>,
  );

describe('PedidoDetalle ▸ Agregar extra', () => {
  it('con permiso, también en un pedido entregado y pagado, ofrece «Agregar extra» y lo abre con el pedido', () => {
    permisos = ['pedidos/extra'];
    const alAgregarExtra = vi.fn();
    const p = pedido();
    ver(p, { alAgregarExtra });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar extra' }));
    expect(alAgregarExtra).toHaveBeenCalledWith(p);
  });

  it('sin permiso no aparece', () => {
    permisos = [];
    ver(pedido());
    expect(screen.queryByRole('button', { name: 'Agregar extra' })).toBeNull();
  });

  it('un pedido anulado no admite extras', () => {
    permisos = ['pedidos/extra'];
    ver(pedido({ estado: 'ANULADO' }));
    expect(screen.queryByRole('button', { name: 'Agregar extra' })).toBeNull();
  });

  it('lista los extras con código, estado y total, enlaza a cada uno y muestra el total con extras', () => {
    permisos = ['pedidos/extra'];
    const alAbrirPedido = vi.fn();
    ver(
      pedido({
        extras: [
          { id: '2', codigo: 'CP-W046', estado: 'COLA', pago_estado: 'PENDIENTE', total: 12 },
          { id: '3', codigo: 'CP-W047', estado: 'ENTREGADO', pago_estado: 'PAGADO', total: 8.5 },
        ],
        total_con_extras: 40.5,
      }),
      { alAbrirPedido },
    );
    const lista = screen.getByTestId('lista-extras');
    expect(lista).toHaveTextContent('CP-W046 · COLA');
    expect(lista).toHaveTextContent('S/ 8.50');
    expect(screen.getByTestId('total-con-extras')).toHaveTextContent('Total con extras');
    expect(screen.getByTestId('total-con-extras')).toHaveTextContent('S/ 40.50');
    fireEvent.click(screen.getByText(/CP-W046 · COLA/));
    expect(alAbrirPedido).toHaveBeenCalledWith('2');
  });

  it('un extra muestra «EXTRA de CP-W045» y enlaza al original', () => {
    permisos = ['pedidos/extra'];
    const alAbrirPedido = vi.fn();
    ver(pedido({ id: '2', codigo: 'CP-W046', pedido_origen: { id: '1', codigo: 'CP-W045' } }), { alAbrirPedido });
    fireEvent.click(screen.getByTestId('insignia-extra'));
    expect(screen.getByTestId('insignia-extra')).toHaveTextContent('EXTRA de CP-W045');
    expect(alAbrirPedido).toHaveBeenCalledWith('1');
  });
});
