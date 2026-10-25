import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';

vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

function pedidoDelivery(repartidorPartyId: number | null): Pedido {
  return {
    id: '1',
    codigo: 'CP-W001',
    canal: 'CARTA',
    modalidad: 'DELIVERY',
    estado: 'LISTO',
    pago_estado: 'PENDIENTE',
    repartidor_party_id: repartidorPartyId,
    subtotal: 30,
    descuento: 0,
    total: 30,
    lineas: [],
  } as unknown as Pedido;
}

function renderDetalle(pedido: Pedido) {
  return render(
    <MemoryRouter>
      <PedidoDetalle pedido={pedido} alActualizar={() => {}} />
    </MemoryRouter>,
  );
}

describe('Entregar un delivery sin repartidor', () => {
  it('muestra el motivo, enlaza Repartos y deshabilita Entregar', () => {
    renderDetalle(pedidoDelivery(null));

    const alerta = screen.getByRole('alert');
    expect(alerta).toHaveTextContent('Asigna un repartidor antes de marcar el pedido como entregado.');
    expect(screen.getByRole('link', { name: 'Ir a Repartos' })).toHaveAttribute('href', '/admin/repartos');
    expect(screen.getByRole('button', { name: 'Entregar al cliente y cerrar' })).toBeDisabled();
  });

  it('con repartidor asignado no muestra el aviso y Entregar queda habilitado', () => {
    renderDetalle(pedidoDelivery(55));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregar al cliente y cerrar' })).toBeEnabled();
  });
});

describe('Botón de anulación según estado de pago (PedidoDetalle)', () => {
  it('muestra "Anular cobro" cuando el pedido está PAGADO y abre modal con esCobro', () => {
    const pedidoPagado: Pedido = {
      id: '2',
      codigo: 'CP-PAG01',
      canal: 'CAJA',
      modalidad: 'LLEVAR',
      estado: 'PREPARANDO',
      pago_estado: 'PAGADO',
      cobro_vigente_id: '88',
      subtotal: 20,
      descuento: 0,
      total: 20,
      lineas: [],
    } as unknown as Pedido;

    renderDetalle(pedidoPagado);

    const btnAnularCobro = screen.getByRole('button', { name: 'Anular cobro' });
    expect(btnAnularCobro).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).not.toBeInTheDocument();
  });

  it('muestra "Anular pedido" cuando el pedido NO está pagado', () => {
    const pedidoNoPagado: Pedido = {
      id: '3',
      codigo: 'CP-NOPAG',
      canal: 'CAJA',
      modalidad: 'LLEVAR',
      estado: 'PREPARANDO',
      pago_estado: 'PENDIENTE',
      subtotal: 20,
      descuento: 0,
      total: 20,
      lineas: [],
    } as unknown as Pedido;

    renderDetalle(pedidoNoPagado);

    const btnAnularPedido = screen.getByRole('button', { name: 'Anular pedido' });
    expect(btnAnularPedido).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular cobro' })).not.toBeInTheDocument();
  });
});
