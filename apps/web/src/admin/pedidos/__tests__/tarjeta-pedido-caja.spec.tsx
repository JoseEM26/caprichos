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
    ['COMER_LOCAL', 'COMER EN EL LOCAL', 'COMER_LOCAL'],
    ['MESA', 'MESA', 'MESA'],
  ])('modalidad %s: línea con texto «%s» e ícono decorativo', (modalidad, texto, clave) => {
    const { container } = pintar({ modalidad });
    const ins = container.querySelector(`[data-modalidad="${clave}"]`)!;
    expect(ins).toHaveTextContent(texto);
    expect(ins.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('mesa con nombre: «MESA 4» y «MESA 4 · Ana» en el nombre', () => {
    const { container } = pintar({ modalidad: 'MESA', mesa_nombre: '4', cliente_nombre: 'Ana' });
    expect(container.querySelector('[data-modalidad="MESA"]')).toHaveTextContent('MESA');
    expect(screen.getByTestId('insignia-mesa')).toHaveTextContent('MESA 4');
    expect(screen.getByRole('heading')).toHaveTextContent('Ana');
  });

  it('delivery con zona: «DELIVERY · zona» y la dirección debajo', () => {
    const { container } = pintar({ modalidad: 'DELIVERY', zona: { nombre: 'Zona 2' }, entrega_direccion: 'Av. Los Olivos 245', entrega_lat: 1, entrega_lng: 2 } as Partial<Pedido>);
    expect(container.querySelector('[data-modalidad="DELIVERY"]')).toHaveTextContent(/DELIVERY.*Zona 2/);
    expect(screen.getByText('Av. Los Olivos 245')).toBeInTheDocument();
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

  it.each([
    ['COLA', 'PAGADO', 'MESA', 'pendiente', '#E67929'],
    ['PREPARANDO', 'PAGADO', 'LLEVAR', 'prep', '#D99E39'],
    ['LISTO', 'PAGADO', 'LLEVAR', 'listo', '#2F7A45'],
    ['EN_CAMINO', 'PAGADO', 'DELIVERY', 'camino', '#2C4C5D'],
  ])('estado %s: barra y chip con el color del estado (%s)', (estado, pago, modalidad, clave, color) => {
    const { container } = pintar({ estado, pago_estado: pago, modalidad } as Partial<Pedido>);
    expect(container.querySelector('.cj2-card')).toHaveAttribute('data-estado', clave);
    expect(screen.getByTestId('barra-estado')).toHaveStyle({ backgroundColor: color });
  });

  it('el chip por confirmar es naranja con texto navy', () => {
    pintar({ estado: 'NUEVO', modalidad: 'LLEVAR' });
    const chip = screen.getByTestId('chip-estado');
    expect(chip).toHaveTextContent('Por confirmar');
    expect(chip.style.color).toContain('--cp-navy');
  });

  it.each([
    ['2026-11-07T15:00:00Z', 12, 'verde'],
    ['2026-11-07T14:30:00Z', 42, 'oxido'],
    ['2026-11-07T14:00:00Z', 72, 'rojo'],
  ])('espera %s (%i min) es %s; en cerrados es neutra', (creado, min, nivel) => {
    const { container, unmount } = pintar({ creado_en: creado });
    expect(container.querySelector('.cj2-espera')).toHaveAttribute('data-nivel', nivel);
    expect(screen.getByRole('timer')).toHaveTextContent(min >= 60 ? '1 h 12' : `${min} min`);
    unmount();
    const r = pintar({ creado_en: creado, estado: 'ENTREGADO' });
    expect(r.container.querySelector('.cj2-espera')).toHaveAttribute('data-nivel', 'neutro');
  });

  it('muestra hasta 3 productos y «+N más»', () => {
    pintar({ lineas: [1, 2, 3, 4, 5].map((n) => ({ cantidad: n, nombre: `Prod ${n}` })) } as unknown as Partial<Pedido>);
    expect(screen.getByText('3× Prod 3')).toBeInTheDocument();
    expect(screen.queryByText('4× Prod 4')).not.toBeInTheDocument();
    expect(screen.getByText('+2 más')).toBeInTheDocument();
  });

  it('conserva los chips: EXTRA de, total con extras y dirección editada', () => {
    pintar({ pedido_origen: { id: '9', codigo: 'CP-0009' }, total_con_extras: 40, ubicacion_editada_en: '2026-11-07T15:00:00Z' } as unknown as Partial<Pedido>);
    expect(screen.getByTestId('insignia-extra')).toHaveTextContent('EXTRA de CP-0009');
    expect(screen.getByTestId('total-con-extras')).toHaveTextContent('S/ 40.00');
    expect(screen.getByText('Dirección editada')).toBeInTheDocument();
  });

  it('el botón de acción es hermano del de abrir (no anidado) y no abre el detalle', () => {
    const alSeleccionar = vi.fn();
    const alAccion = vi.fn();
    const accion = { tipo: 'estado' as const, texto: 'PREPARAR', nuevoEstado: 'PREPARANDO', bg: '#E67929', fg: '#0B2C3E' };
    const { container } = render(
      <TarjetaPedidoCaja
        pedido={{ ...base, estado: 'COLA', pago_estado: 'PAGADO' } as Pedido}
        seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false}
        alSeleccionar={alSeleccionar} accion={accion} alAccion={alAccion}
      />,
    );
    expect(container.querySelector('button button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'PREPARAR CP-0001' }));
    expect(alAccion).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), accion);
    expect(alSeleccionar).not.toHaveBeenCalled();
  });
});
