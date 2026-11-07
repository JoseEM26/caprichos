import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import type { Pedido } from '../pedidosApi';

const base = {
  id: '1', codigo: 'CP-0001', canal: 'CARTA', modalidad: 'LOCAL', estado: 'COLA', total: 25,
  cliente_nombre: 'Lucía Pérez', pago_estado: 'PENDIENTE', creado_en: '2026-11-07T15:00:00Z',
  lineas: [{ cantidad: 2, nombre: 'Carrot cake' }],
} as unknown as Pedido;

const pintar = (p: Partial<Pedido>) =>
  render(
    <TarjetaPedidoCaja
      pedido={{ ...base, ...p } as Pedido}
      seleccionado={false}
      resaltado={false}
      cajaCerradaEspera={false}
      cambioCobroPendiente={false}
      alSeleccionar={vi.fn()}
      ahora={Date.parse('2026-11-07T15:12:00Z')}
    />,
  );

describe('TarjetaPedidoCaja', () => {
  it('muestra el nombre grande como título y el total', () => {
    pintar({});
    expect(screen.getByRole('heading', { name: 'Lucía Pérez' })).toHaveClass('cj-pc-nombre');
    expect(screen.getByText('S/ 25.00')).toBeInTheDocument();
    expect(screen.getByText('12 min', { exact: false })).toBeInTheDocument();
  });

  it.each([
    ['DELIVERY', 'DELIVERY', 'DELIVERY'],
    ['RECOGER', 'PARA LLEVAR', 'LLEVAR'],
    ['LLEVAR', 'PARA LLEVAR', 'LLEVAR'],
    ['LOCAL', 'EN EL LOCAL', 'LOCAL'],
    ['MESA', 'MESA', 'MESA'],
  ])('modalidad %s: insignia con texto %s e ícono decorativo', (modalidad, texto, clave) => {
    const { container } = pintar({ modalidad });
    const ins = container.querySelector(`[data-modalidad="${clave}"]`)!;
    expect(ins).toHaveTextContent(texto);
    expect(ins.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('mesa con nombre: «MESA 4» y «Mesa 4 · Ana» en el nombre', () => {
    const { container } = pintar({ modalidad: 'MESA', mesa_nombre: '4', cliente_nombre: 'Ana' });
    expect(container.querySelector('[data-modalidad="MESA"]')).toHaveTextContent('MESA 4');
    expect(screen.getByRole('heading')).toHaveTextContent('MESA 4 · Ana');
  });

  it('sin nombre dice «Cliente»', () => {
    pintar({ cliente_nombre: null });
    expect(screen.getByRole('heading', { name: 'Cliente' })).toBeInTheDocument();
  });

  it('código CP-W es canal WhatsApp', () => {
    const { container } = pintar({ codigo: 'CP-W041', canal: 'BOT' });
    expect(container.querySelector('[data-canal="WHATSAPP"]')).toHaveTextContent('WhatsApp');
    expect(screen.getByText('CP-W041')).toBeInTheDocument();
  });

  it('delivery sin ubicación avisa «Falta la ubicación»', () => {
    pintar({ modalidad: 'DELIVERY', entrega_lat: null, entrega_lng: null } as Partial<Pedido>);
    expect(screen.getByText('Falta la ubicación')).toBeInTheDocument();
  });

  it('pagado y clic seleccionan el pedido', () => {
    const alSeleccionar = vi.fn();
    render(
      <TarjetaPedidoCaja
        pedido={{ ...base, pago_estado: 'PAGADO' } as Pedido}
        seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false}
        alSeleccionar={alSeleccionar}
      />,
    );
    expect(screen.getByText('Pagado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(alSeleccionar).toHaveBeenCalledWith('1');
  });
});
