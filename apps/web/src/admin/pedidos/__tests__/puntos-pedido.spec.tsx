import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';
// PedidoDetalle usa useSesion (botón de rechazo del cobro del mozo): sin sesión en estas pruebas, sin permisos extra
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: () => false, usuario: null }),
}));


vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const pedido = (puntos: Pedido['puntos']) =>
  ({ id: '1', codigo: 'CP-W001', canal: 'CARTA', modalidad: 'RECOGER', estado: 'LISTO', pago_estado: 'PENDIENTE', subtotal: 15, descuento: 0, total: 15, lineas: [], puntos }) as unknown as Pedido;

const ver = (p: Pedido) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={() => {}} />
    </MemoryRouter>,
  );

describe('PedidoDetalle ▸ línea de puntos', () => {
  it('pendiente: dice cuántos se sumarán', () => {
    ver(pedido({ estado: 'PENDIENTE_DE_COBRO', estimado: 0.75, texto: 'Se sumarán 0.75 puntos cuando Caja cobre tu pedido' }));
    expect(screen.getByText('Se sumarán 0.75')).toBeInTheDocument();
  });
  it('no suma: dice el motivo', () => {
    ver(pedido({ estado: 'NO_SUMA', motivo: 'CUPON', texto: 'Este pedido no suma puntos porque usaste un cupón' }));
    expect(screen.getByText(/No suma: Este pedido no suma puntos porque usaste un cupón/)).toBeInTheDocument();
  });
});
