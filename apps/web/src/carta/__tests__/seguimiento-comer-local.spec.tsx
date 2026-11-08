import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PantallaConfirmacion } from '../PantallaConfirmacion';

let estado: any = null;
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({
    pedidoConfirmado: { codigo: 'CP-1', seguimientoToken: 't', modalidad: 'COMER_LOCAL', clienteNombre: 'Rosa' },
    setPedidoConfirmado: vi.fn(),
    seguimientoAbierto: null,
    setSeguimientoAbierto: vi.fn(),
  }),
}));
vi.mock('../seguimiento', () => ({
  leerPedidosGuardados: () => [],
  useSeguimientoPedido: () => ({ estado, error: false }),
}));
vi.mock('../../pwa/BannerInstalarApp', () => ({ BannerInstalarApp: () => null }));

const base = { codigo: 'CP-1', estado: 'COLA', estadoEtiqueta: 'En cola', modalidad: 'COMER_LOCAL', total: 10, terminado: false, anulado: false, pasos: [] };

describe('Seguimiento del cliente: comer en el local', () => {
  it.each([
    [{}, 'Estamos preparando tu pedido, Rosa. Te llamaremos por tu nombre.'],
    [{ ubicacion: 'SIN_MESA' }, 'Estamos preparando tu pedido, Rosa. Te llamaremos por tu nombre.'],
    [{ ubicacion: 'EN_ESPERA' }, 'Estamos buscando tu mesa: te llamaremos, Rosa.'],
    [{ ubicacion: 'ASIGNADA', mesa: 'Mesa 4' }, 'Tu mesa es la Mesa 4.'],
  ])('%j', (extra, texto) => {
    estado = { ...base, ...extra };
    render(<PantallaConfirmacion />);
    expect(screen.getByTestId('texto-comer-local')).toHaveTextContent(texto);
  });
});
