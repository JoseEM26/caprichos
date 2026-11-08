import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChipCobroMozo } from '../PedidosAdminView';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';
import * as sesionModulo from '../../../comun/sesion';

vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

let permisos: string[] = ['caja/cobrar'];
beforeEach(() => {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    tiene: (permiso: string) => permisos.includes(permiso),
  } as any);
  permisos = ['caja/cobrar'];
});

const base = {
  id: 'ped-9',
  codigo: 'CP-W009',
  canal: 'MOZO',
  modalidad: 'MESA',
  mesa_nombre: 'Mesa 4',
  cliente_nombre: 'Ana',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  creado_en: '2026-10-30T20:00:00.000Z',
  subtotal: 30,
  descuento: 0,
  total: 30,
  lineas: [],
} as unknown as Pedido;

describe('ChipCobroMozo (Caja y Pedidos)', () => {
  it('no pinta nada si el mozo no envió el cobro', () => {
    const { container } = render(<ChipCobroMozo cobro={null} />);
    expect(container.textContent).toBe('');
  });

  it('digital con voucher: «Cobrado por mozo · Yape» sin aviso', () => {
    render(<ChipCobroMozo cobro={{ en: '2026-10-30T20:00:00.000Z', medio: 'YAPE', mozo: 'Juan', faltaVoucher: false }} />);
    expect(screen.getByText('Cobrado por mozo · Yape')).toBeDefined();
    expect(screen.queryByText(/falta captura/)).toBeNull();
  });

  it('plan con efectivo y Yape sin voucher: nombres legibles y «falta captura (opcional)» en color de advertencia', () => {
    render(
      <ChipCobroMozo cobro={{ en: '2026-10-30T20:00:00.000Z', medio: 'EFECTIVO+YAPE', mozo: 'Juan', faltaVoucher: true }} />,
    );
    const chip = screen.getByText(/Cobrado por mozo · Efectivo \+ Yape/);
    expect(chip.textContent).toContain('falta captura (opcional)');
    expect(chip.style.color).toBe('var(--cp-rust, #B2500F)');
  });
});

describe('PedidoDetalle: cobro del mozo en el encabezado', () => {
  it('muestra el chip, el mozo y la hora (Lima)', () => {
    const pedido = {
      ...base,
      cobroMozo: { en: '2026-10-30T20:00:00.000Z', medio: 'YAPE', mozo: 'Juan Mozo', faltaVoucher: true },
    } as Pedido;
    render(
      <MemoryRouter>
        <PedidoDetalle pedido={pedido} alActualizar={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Cobrado por mozo · Yape/)).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    expect(screen.getByText(/Mozo: Juan Mozo · a las \d/)).toBeDefined();
  });

  it('sin cobro del mozo no muestra la etiqueta', () => {
    render(
      <MemoryRouter>
        <PedidoDetalle pedido={{ ...base, cobroMozo: null } as Pedido} alActualizar={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Cobrado por mozo/)).toBeNull();
  });
});

describe('PedidoDetalle: rechazar el cobro del mozo solo con caja/cobrar', () => {
  const pedidoConCobro = {
    ...base,
    cobroMozo: { en: '2026-10-30T20:00:00.000Z', medio: 'EFECTIVO', mozo: 'Juan Mozo', faltaVoucher: false, recibido: 50, vuelto: 18, pide: null },
  } as Pedido;

  it('con caja/cobrar muestra el botón y el recibido con el vuelto', () => {
    render(<MemoryRouter><PedidoDetalle pedido={pedidoConCobro} alActualizar={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Pago y voucher' }));
    expect(screen.getByRole('button', { name: 'Rechazar cobro del mozo' })).toBeInTheDocument();
    expect(screen.getByText(/Recibió S\/ 50\.00 · vuelto S\/ 18\.00/)).toBeInTheDocument();
  });

  it('sin caja/cobrar no muestra el botón', () => {
    permisos = ['caja/ver'];
    render(<MemoryRouter><PedidoDetalle pedido={pedidoConCobro} alActualizar={() => {}} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Rechazar cobro del mozo' })).toBeNull();
    expect(screen.getByText(/Cobrado por mozo/)).toBeInTheDocument();
  });

  it('pedido ya PAGADO no muestra el botón aunque tenga permiso', () => {
    render(<MemoryRouter><PedidoDetalle pedido={{ ...pedidoConCobro, pago_estado: 'PAGADO' } as Pedido} alActualizar={() => {}} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Rechazar cobro del mozo' })).toBeNull();
  });
});

describe('ChipCobroMozo: comprobante que pidió el mozo', () => {
  it('muestra «pide Factura» cuando el mozo la pidió; sin pide, el chip no cambia', () => {
    const { rerender } = render(
      <ChipCobroMozo cobro={{ en: '2026-10-30T20:00:00.000Z', medio: 'EFECTIVO', mozo: 'Juan', faltaVoucher: false, pide: 'FACTURA' }} />,
    );
    expect(screen.getByText(/pide Factura/)).toBeInTheDocument();
    rerender(<ChipCobroMozo cobro={{ en: '2026-10-30T20:00:00.000Z', medio: 'EFECTIVO', mozo: 'Juan', faltaVoucher: false, pide: null }} />);
    expect(screen.queryByText(/pide/)).toBeNull();
  });
});
