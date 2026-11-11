import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido, pedidosApi } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

let permisos: string[] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  permisos = ['caja/cobrar'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
});

const pedido = (extra: Partial<Pedido> = {}) =>
  ({
    id: 'ped-9',
    codigo: 'CP-W009',
    canal: 'CARTA',
    modalidad: 'RECOGER',
    cliente_nombre: 'Ana',
    estado: 'COLA',
    pago_estado: 'PENDIENTE',
    creado_en: '2026-11-02T20:00:00.000Z',
    subtotal: 30,
    descuento: 0,
    total: 30,
    comprobante_tipo: 'NOTA_VENTA',
    comprobante_doc: null,
    comprobante_razon: null,
    comprobante_direccion: null,
    lineas: [],
    ...extra,
  }) as unknown as Pedido;

/** El comprobante vive en la capa «Pago y voucher». */
const renderizar = (p: Pedido) => {
  const r = render(
    <MemoryRouter>
      <PedidoDetalle pedido={p} alActualizar={vi.fn()} cajaAbierta={true} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
  return r;
};

describe('PedidoDetalle: cambiar comprobante antes de cobrar', () => {
  it('cambia a factura tras confirmar con Sí, y envía el RUC y la razón social', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarComprobante').mockResolvedValue({} as any);
    renderizar(pedido());

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar comprobante' }));
    const panel = screen.getByLabelText('Cambiar comprobante');
    fireEvent.click(within(panel).getByTestId('comprobante-FACTURA'));
    fireEvent.change(within(panel).getByLabelText('DNI o RUC'), { target: { value: '20123456789' } });
    fireEvent.change(within(panel).getByLabelText('Razón social'), { target: { value: 'Acme SAC' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar comprobante' }));
    expect(cambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cambiar' }));

    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('ped-9', { tipo: 'FACTURA', doc: '20123456789', razon: 'Acme SAC' }));
  });

  it('con No no cambia nada', () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarComprobante').mockResolvedValue({} as any);
    renderizar(pedido());
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar comprobante' }));
    const panel = screen.getByLabelText('Cambiar comprobante');
    fireEvent.click(within(panel).getByTestId('comprobante-BOLETA'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar comprobante' }));
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('ya cobrado: no ofrece cambiar el comprobante', () => {
    renderizar(pedido({ pago_estado: 'PAGADO' } as any));
    expect(screen.queryByRole('button', { name: 'Cambiar comprobante' })).toBeNull();
  });
});
