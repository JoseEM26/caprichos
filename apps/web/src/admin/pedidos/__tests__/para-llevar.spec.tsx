import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { SelectorParaLlevar, AtajoParaLlevar, ResumenParaLlevar, modalidadPermiteParaLlevar, resumenParaLlevar } from '../paraLlevar';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { CapaProductos } from '../CapaProductos';
import { ComandaTarjeta } from '../../cocina/ComandaTarjeta';
import type { Comanda } from '../../cocina/cocinaTipos';
import type { Pedido } from '../pedidosApi';

describe('para llevar: selector por línea', () => {
  it('«Comer aquí | Para llevar» es un grupo de radios de 44 px con el estado marcado', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar paraLlevar={false} onCambiar={onCambiar} etiqueta="Dónde se come: Americano" />);
    const grupo = screen.getByRole('radiogroup', { name: 'Dónde se come: Americano' });
    const aqui = within(grupo).getByRole('radio', { name: 'Comer aquí' });
    const llevar = within(grupo).getByRole('radio', { name: /Para llevar/ });
    expect(aqui).toHaveAttribute('aria-checked', 'true');
    expect(llevar).toHaveAttribute('aria-checked', 'false');
    expect(aqui.style.minHeight).toBe('44px');
    fireEvent.click(llevar);
    expect(onCambiar).toHaveBeenCalledWith(true);
  });

  it('tocar la opción ya activa no vuelve a avisar', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar paraLlevar={true} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByTestId('para-llevar-si'));
    expect(onCambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('para-llevar-no'));
    expect(onCambiar).toHaveBeenCalledWith(false);
  });

  it('deshabilitado (combo bloqueado): no cambia', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar paraLlevar={false} disabled onCambiar={onCambiar} />);
    fireEvent.click(screen.getByTestId('para-llevar-si'));
    expect(onCambiar).not.toHaveBeenCalled();
  });
});

describe('para llevar: atajo y resumen', () => {
  it('«Todo para llevar» y «Todo aquí» pasan el valor a todo el pedido', () => {
    const onTodo = vi.fn();
    render(<AtajoParaLlevar onTodo={onTodo} />);
    fireEvent.click(screen.getByRole('button', { name: 'Todo para llevar' }));
    expect(onTodo).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Todo aquí' }));
    expect(onTodo).toHaveBeenLastCalledWith(false);
  });

  it('el resumen cuenta unidades y solo aparece cuando hay mezcla', () => {
    const mezcla = [
      { cantidad: 2, paraLlevar: true },
      { cantidad: 4, paraLlevar: false },
    ];
    expect(resumenParaLlevar(mezcla)).toEqual({ llevar: 2, aqui: 4, mezcla: true });
    render(<ResumenParaLlevar lineas={mezcla} />);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('2 para llevar · 4 aquí');
  });

  it('sin mezcla no hay resumen', () => {
    const { container } = render(<ResumenParaLlevar lineas={[{ cantidad: 3, paraLlevar: false }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('solo MESA y COMER_LOCAL admiten para llevar por línea', () => {
    expect(modalidadPermiteParaLlevar('MESA')).toBe(true);
    expect(modalidadPermiteParaLlevar('COMER_LOCAL')).toBe(true);
    expect(modalidadPermiteParaLlevar('DELIVERY')).toBe(false);
    expect(modalidadPermiteParaLlevar('RECOGER')).toBe(false);
  });
});

const pedidoBase = {
  id: '1', codigo: 'CP-0042', canal: 'CAJA', modalidad: 'MESA', estado: 'COLA', total: 40,
  cliente_nombre: 'Diana', pago_estado: 'PENDIENTE', creado_en: '2026-11-17T15:00:00Z', mesa_nombre: 'Mesa 6',
  lineas: [
    { id: 11, cantidad: 2, nombre: 'Carrot cake', paraLlevar: true, precio_unit: 10, subtotal: 20 },
    { id: 12, cantidad: 4, nombre: 'Latte', paraLlevar: false, precio_unit: 5, subtotal: 20 },
  ],
} as unknown as Pedido;

const tarjeta = (p: Partial<Pedido>) =>
  render(
    <TarjetaPedidoCaja pedido={{ ...pedidoBase, ...p } as Pedido} seleccionado={false} resaltado={false}
      cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()} ahora={Date.parse('2026-11-17T15:12:00Z')} />,
  );

describe('para llevar en Caja', () => {
  it('pedido de mesa con mezcla: chip por producto y resumen en la cabecera', () => {
    tarjeta({});
    const chips = screen.getAllByTestId('chip-para-llevar');
    expect(chips).toHaveLength(1);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('2 para llevar · 4 aquí');
  });

  it('delivery: sin chip ni resumen aunque la línea llegara marcada', () => {
    tarjeta({ modalidad: 'DELIVERY', entrega_direccion: 'Av. Siempre Viva 123' } as Partial<Pedido>);
    expect(screen.queryByTestId('chip-para-llevar')).toBeNull();
    expect(screen.queryByTestId('resumen-para-llevar')).toBeNull();
  });

  it('detalle del pedido: marca la línea para llevar y el resumen', () => {
    render(
      <CapaProductos pedido={{ ...pedidoBase } as Pedido} puedeDarCortesia={false} alCortesia={() => {}} />,
    );
    expect(screen.getAllByTestId('chip-para-llevar')).toHaveLength(1);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('2 para llevar · 4 aquí');
  });
});

const comanda = (over: Partial<Comanda> = {}): Comanda => ({
  id: '301-1', pedidoId: '301', areaId: '1', areaNombre: 'Barra', ticket: 'CP-301', codigo: 'CP-301', canal: 'CAJA',
  modalidad: 'MESA', minutos: 5, color: 'VERDE', creado_en: new Date().toISOString(),
  lineas: [
    { id: 'l1', nombre: 'Americano', cantidad: 1, opciones: [], personas: [], nota: null, paraLlevar: true },
    { id: 'l2', nombre: 'Limonada', cantidad: 2, opciones: [], personas: [], nota: null, paraLlevar: false },
  ],
  despejada: false,
  ...over,
} as Comanda);

describe('para llevar en cocina', () => {
  it('la línea para llevar se ve destacada; la que se come aquí no', () => {
    render(<ComandaTarjeta comanda={comanda()} onDespejar={() => {}} />);
    const marcada = screen.getByTestId('linea-l1');
    expect(within(marcada).getByTestId('linea-para-llevar')).toHaveTextContent('PARA LLEVAR');
    expect(marcada.style.borderLeft).toContain('4px');
    const normal = screen.getByTestId('linea-l2');
    expect(within(normal).queryByTestId('linea-para-llevar')).toBeNull();
  });

  it('un pedido solo para comer aquí no cambia nada visible', () => {
    const sinLlevar = comanda({
      lineas: [{ id: 'l1', nombre: 'Americano', cantidad: 1, opciones: [], personas: [], nota: null, paraLlevar: false }],
    } as Partial<Comanda>);
    render(<ComandaTarjeta comanda={sinLlevar} onDespejar={() => {}} />);
    expect(screen.queryByTestId('linea-para-llevar')).toBeNull();
  });
});
