import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import type { Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

let permisos: string[] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  permisos = ['pedidos/editar'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p), usuario: { partyId: '9' } } as any);
});

const pedido = (extra: Record<string, unknown> = {}) =>
  ({
    id: 'ped-9',
    codigo: 'CP-W009',
    canal: 'CAJA',
    modalidad: 'RECOGER',
    cliente_nombre: 'Ana',
    estado: 'PREPARANDO',
    pago_estado: 'PENDIENTE',
    creado_en: '2026-11-02T20:00:00.000Z',
    subtotal: 30,
    descuento: 0,
    total: 30,
    lineas: [],
    ...extra,
  }) as unknown as Pedido;

const renderizar = (p: Pedido, props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={vi.fn()} alEditar={vi.fn()} cajaAbierta={true} {...props} />
    </MemoryRouter>,
  );

describe('PedidoDetalle: botón «Editar pedido»', () => {
  it.each(['COLA', 'PREPARANDO', 'LISTO'])('se ofrece con permiso en un pedido %s sin cobrar y abre el editor', (estado) => {
    const alEditar = vi.fn();
    const p = pedido({ estado });
    renderizar(p, { alEditar });
    fireEvent.click(screen.getByRole('button', { name: 'Editar pedido' }));
    expect(alEditar).toHaveBeenCalledWith(p);
  });

  it('no se ofrece sin el permiso pedidos/editar', () => {
    permisos = [];
    renderizar(pedido());
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).toBeNull();
  });

  it.each([
    ['entregado', { estado: 'ENTREGADO' }],
    ['anulado', { estado: 'ANULADO' }],
    ['pagado', { pago_estado: 'PAGADO' }],
    ['con cobro vigente', { cobro_vigente_id: '5' }],
    ['cobrado por el mozo', { cobroMozo: { en: '2026-11-02T20:10:00Z', medio: 'YAPE', mozo: 'Luis', faltaVoucher: false } }],
  ])('no se ofrece en un pedido %s', (_n, extra) => {
    renderizar(pedido(extra));
    expect(screen.queryByRole('button', { name: 'Editar pedido' })).toBeNull();
  });

  it('muestra «Ana está editando este pedido» cuando otra persona tiene abierto el editor', () => {
    renderizar(pedido(), { editandoPor: 'Ana' });
    expect(screen.getByRole('status')).toHaveTextContent('Ana está editando este pedido.');
  });

  it('sin nadie editando no muestra el aviso', () => {
    renderizar(pedido());
    expect(screen.queryByText(/está editando este pedido/)).toBeNull();
  });
});
