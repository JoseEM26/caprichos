import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChipCobroMozo } from '../PedidosAdminView';
import { PedidoDetalle } from '../PedidoDetalle';
import { Pedido } from '../pedidosApi';

vi.mock('../../creditos/creditosApi', () => ({
  listarPersonalActivo: vi.fn().mockResolvedValue([]),
  registrarConsumoCredito: vi.fn(),
}));

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
    expect(screen.queryByText(/falta voucher/)).toBeNull();
  });

  it('plan con efectivo y Yape sin voucher: nombres legibles y «falta voucher» en color de advertencia', () => {
    render(
      <ChipCobroMozo cobro={{ en: '2026-10-30T20:00:00.000Z', medio: 'EFECTIVO+YAPE', mozo: 'Juan', faltaVoucher: true }} />,
    );
    const chip = screen.getByText(/Cobrado por mozo · Efectivo \+ Yape/);
    expect(chip.textContent).toContain('falta voucher');
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
