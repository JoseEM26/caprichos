import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';

let usuario: any = { rol: 'ADMIN', partyId: '1' };
let permisos: string[] = ['pedidos/anular'];
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario }),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const pedido = (extra: Record<string, unknown> = {}) =>
  ({ id: '9', codigo: 'CP-W110', canal: 'CAJA', modalidad: 'RECOGER', estado: 'ANULADO', pago_estado: 'PENDIENTE', subtotal: 10, descuento: 0, total: 10, lineas: [], ...extra }) as unknown as Pedido;

const render1 = (p: Pedido) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={() => {}} cajaAbierta />
    </MemoryRouter>,
  );

describe('Botón «Revertir anulación»', () => {
  beforeEach(() => {
    usuario = { rol: 'ADMIN', partyId: '1' };
    permisos = ['pedidos/anular'];
  });

  it.each(['ADMIN', 'SUPERVISOR'])('lo ve %s en un pedido anulado', (rol) => {
    usuario = { rol, partyId: '1' };
    render1(pedido());
    expect(screen.getByRole('button', { name: 'Revertir la anulación del pedido CP-W110' })).toBeEnabled();
  });

  it.each(['CAJERO', 'MOZO'])('no lo ve %s', (rol) => {
    usuario = { rol, partyId: '1' };
    render1(pedido());
    expect(screen.queryByRole('button', { name: /Revertir la anulación/ })).not.toBeInTheDocument();
  });

  it('un supervisor como rol extra también lo ve; un pedido no anulado no lo muestra', () => {
    usuario = { rol: 'MOZO', roles: ['MOZO', 'SUPERVISOR'], partyId: '1' };
    const { unmount } = render1(pedido());
    expect(screen.getByRole('button', { name: /Revertir la anulación/ })).toBeInTheDocument();
    unmount();
    render1(pedido({ estado: 'LISTO' }));
    expect(screen.queryByRole('button', { name: /Revertir la anulación/ })).not.toBeInTheDocument();
  });
});

describe('Pedido pagado sin entregar: además de «Anular cobro», «Anular pedido»', () => {
  it('aparece con cobro vigente en LISTO y abre la pregunta del dinero', async () => {
    usuario = { rol: 'ADMIN', partyId: '1' };
    permisos = ['pedidos/anular'];
    render1(pedido({ estado: 'LISTO', pago_estado: 'PAGADO', modalidad: 'DELIVERY' }));
    const boton = screen.getByRole('button', { name: 'Anular pedido pagado' });
    boton.click();
    expect(await screen.findByText('¿Qué pasa con el dinero?')).toBeInTheDocument();
  });
});
