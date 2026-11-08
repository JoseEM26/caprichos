import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido, pedidosApi } from '../pedidosApi';

let permisos: string[] = ['pedidos/anular'];
vi.mock('../../../comun/sesion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../comun/sesion')>()),
  useSesion: () => ({ tiene: (p: string) => permisos.includes(p), usuario: null }),
}));
vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    id: '9',
    codigo: 'CP-W110',
    canal: 'CAJA',
    modalidad: 'RECOGER',
    estado: 'ENTREGADO',
    pago_estado: 'PAGADO',
    entregado_en: new Date().toISOString(),
    subtotal: 10,
    descuento: 0,
    total: 10,
    lineas: [],
    ...extra,
  }) as unknown as Pedido;

function renderDetalle(p: Pedido, alActualizar = () => {}, cajaAbierta: boolean | null = true) {
  return render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={alActualizar} cajaAbierta={cajaAbierta} />
    </MemoryRouter>,
  );
}

describe('Volver atrás un pedido entregado', () => {
  beforeEach(() => {
    permisos = ['pedidos/anular'];
    vi.restoreAllMocks();
  });

  it('con permiso aparece en entregados', () => {
    renderDetalle(pedido());
    expect(screen.getByRole('button', { name: 'Volver atrás el pedido CP-W110' })).toBeEnabled();
  });

  it('sin permiso no aparece', () => {
    permisos = [];
    renderDetalle(pedido());
    expect(screen.queryByRole('button', { name: /Volver atrás/ })).not.toBeInTheDocument();
  });

  it('no aparece en activos ni anulados; el anulado muestra la nota', () => {
    const { unmount } = renderDetalle(pedido({ estado: 'LISTO', pago_estado: 'PENDIENTE' }));
    expect(screen.queryByRole('button', { name: /Volver atrás/ })).not.toBeInTheDocument();
    unmount();
    renderDetalle(pedido({ estado: 'ANULADO' }));
    expect(screen.queryByRole('button', { name: /Volver atrás/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Un pedido anulado no se puede reabrir/)).toBeInTheDocument();
  });

  it('caja cerrada: deshabilitado con el motivo', () => {
    renderDetalle(pedido(), () => {}, false);
    expect(screen.getByRole('button', { name: 'Volver atrás el pedido CP-W110' })).toBeDisabled();
    expect(screen.getByText('Ya cerró la caja del día')).toBeInTheDocument();
  });

  it('modal con advertencia y motivo obligatorio; al confirmar avisa y actualiza', async () => {
    const reabrir = vi.spyOn(pedidosApi, 'reabrir').mockResolvedValue({ estado: 'LISTO' } as Pedido);
    const alActualizar = vi.fn();
    renderDetalle(pedido(), alActualizar);
    fireEvent.click(screen.getByRole('button', { name: 'Volver atrás el pedido CP-W110' }));
    expect(screen.getByText(/volverá a LISTO/)).toHaveTextContent('El cliente ya recibió el aviso de entregado y no se puede deshacer');
    const si = screen.getByRole('button', { name: 'Sí, volver atrás' });
    expect(si).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Me confundí' } });
    fireEvent.click(si);
    await waitFor(() => expect(reabrir).toHaveBeenCalledWith('9', 'Me confundí'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('CP-W110 volvió a LISTO'));
    expect(alActualizar).toHaveBeenCalled();
  });

  it('delivery que ya salió dice EN CAMINO y muestra el error del servidor', async () => {
    vi.spyOn(pedidosApi, 'reabrir').mockRejectedValue(new Error('El repartidor ya liquidó este pedido'));
    renderDetalle(pedido({ modalidad: 'DELIVERY', despachado_en: new Date().toISOString(), repartidor_party_id: 5 }));
    fireEvent.click(screen.getByRole('button', { name: 'Volver atrás el pedido CP-W110' }));
    expect(screen.getByText(/volverá a EN CAMINO/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'Me confundí' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, volver atrás' }));
    expect(await screen.findByText('El repartidor ya liquidó este pedido')).toBeInTheDocument();
  });
});
