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
