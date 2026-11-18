import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  SelectorParaLlevar,
  AtajoParaLlevar,
  ResumenParaLlevar,
  DialogoCuantosLlevar,
  modalidadPermiteParaLlevar,
  puedeRepartirLinea,
  repartirParaLlevar,
  resumenParaLlevar,
} from '../paraLlevar';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import { CapaProductos } from '../CapaProductos';
import { ComandaTarjeta } from '../../cocina/ComandaTarjeta';
import type { Comanda } from '../../cocina/cocinaTipos';
import type { LineaPedido, Pedido } from '../pedidosApi';

describe('para llevar por unidad: selector', () => {
  it('«Comer aquí | Para llevar» es un grupo de radios con el estado marcado', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar cantidad={1} llevar={0} onCambiar={onCambiar} etiqueta="Dónde se come: Americano" />);
    const grupo = screen.getByRole('radiogroup', { name: 'Dónde se come: Americano' });
    const aqui = within(grupo).getByRole('radio', { name: 'Comer aquí' });
    const llevar = within(grupo).getByRole('radio', { name: /Para llevar/ });
    expect(aqui).toHaveAttribute('aria-checked', 'true');
    expect(llevar).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(llevar);
    expect(onCambiar).toHaveBeenCalledWith(1);
  });

  it('tocar la opción ya activa no vuelve a avisar', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar cantidad={2} llevar={2} onCambiar={onCambiar} />);
    fireEvent.click(screen.getByTestId('para-llevar-si'));
    expect(onCambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('para-llevar-no'));
    expect(onCambiar).toHaveBeenCalledWith(0);
  });

  it('deshabilitado (combo bloqueado): no cambia', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar cantidad={1} llevar={0} disabled onCambiar={onCambiar} />);
    fireEvent.click(screen.getByTestId('para-llevar-si'));
    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('con 2 o más unidades muestra el contador «− k + de N» y lo cambia de uno en uno', () => {
    const onCambiar = vi.fn();
    render(<SelectorParaLlevar cantidad={2} llevar={1} onCambiar={onCambiar} />);
    expect(screen.getByTestId('llevar-cuenta')).toHaveTextContent('1 de 2');
    // con una parte para llevar, ninguno de los dos botones del segmento está marcado
    expect(screen.getByTestId('para-llevar-si')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('llevar-mas'));
    expect(onCambiar).toHaveBeenLastCalledWith(2);
    fireEvent.click(screen.getByTestId('llevar-menos'));
    expect(onCambiar).toHaveBeenLastCalledWith(0);
  });

  it('una línea de 1 unidad o no divisible no muestra el contador', () => {
    const { rerender } = render(<SelectorParaLlevar cantidad={1} llevar={0} onCambiar={vi.fn()} />);
    expect(screen.queryByTestId('llevar-stepper')).toBeNull();
    rerender(<SelectorParaLlevar cantidad={3} llevar={0} dividible={false} onCambiar={vi.fn()} />);
    expect(screen.queryByTestId('llevar-stepper')).toBeNull();
  });
});

describe('para llevar por unidad: reparto de la línea', () => {
  const linea = { productoId: 5, cantidad: 2, nota: 'sin hielo', personas: [] as string[] };

  it('N=2, k=1 se reparte en dos líneas: una aquí y otra para llevar', () => {
    const r = repartirParaLlevar(linea, 1);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ cantidad: 1, nota: 'sin hielo' });
    expect(r[0].paraLlevar).toBeUndefined();
    expect(r[1]).toMatchObject({ cantidad: 1, paraLlevar: true, nota: 'sin hielo' });
  });

  it('k=0 o k=N no divide', () => {
    expect(repartirParaLlevar(linea, 0)).toEqual([linea]);
    const todas = repartirParaLlevar(linea, 2);
    expect(todas).toHaveLength(1);
    expect(todas[0]).toMatchObject({ cantidad: 2, paraLlevar: true });
  });

  it('con nombres de vaso, la primera parte se queda con los primeros y la última va para llevar', () => {
    const [aqui, llevar] = repartirParaLlevar({ ...linea, cantidad: 3, personas: ['Ana', 'Beto', 'Cata'] }, 1);
    expect(aqui.personas).toEqual(['Ana', 'Beto']);
    expect(llevar.personas).toEqual(['Cata']);
  });

  it('combos, mezclas, ofertas y líneas de una unidad van completas', () => {
    expect(puedeRepartirLinea({ cantidad: 2 })).toBe(true);
    expect(puedeRepartirLinea({ cantidad: 1 })).toBe(false);
    expect(puedeRepartirLinea({ cantidad: 2, bloqueada: true })).toBe(false);
    expect(puedeRepartirLinea({ cantidad: 2, unidadesPorMezcla: 6 })).toBe(false);
    expect(puedeRepartirLinea({ cantidad: 2, comboElecciones: [{}] })).toBe(false);
    expect(puedeRepartirLinea({ cantidad: 2, ofertaId: '9' })).toBe(false);
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

  it('el resumen cuenta unidades (no líneas) y solo aparece cuando hay mezcla', () => {
    const mezcla = [
      { cantidad: 2, llevar: 1 },
      { cantidad: 4, paraLlevar: false },
    ];
    expect(resumenParaLlevar(mezcla)).toEqual({ llevar: 1, aqui: 5, mezcla: true });
    render(<ResumenParaLlevar lineas={mezcla} />);
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('1 para llevar · 5 aquí');
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

describe('para llevar: diálogo «¿Cuántos para llevar?»', () => {
  it('confirma con las unidades elegidas', () => {
    const onConfirmar = vi.fn();
    render(<DialogoCuantosLlevar nombre="Frappe Oreo" cantidad={2} llevar={0} onConfirmar={onConfirmar} onCerrar={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '¿Cuántos para llevar?' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('llevar-mas'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onConfirmar).toHaveBeenCalledWith(1);
  });

  it('sin cambios, Guardar está apagado', () => {
    render(<DialogoCuantosLlevar nombre="Frappe" cantidad={2} llevar={1} onConfirmar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
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

describe('para llevar en Caja: cambiar después de creado', () => {
  const linea = (over: Partial<LineaPedido>): LineaPedido =>
    ({ id: '21', nombre: 'Frappe Oreo', cantidad: 2, precio_unit: 7, subtotal: 14, paraLlevar: false, linea_combo_id: null, oferta_id: null, producto_id: '5', ...over }) as LineaPedido;
  const pedidoCon = (lineas: LineaPedido[], over: Partial<Pedido> = {}) =>
    ({ ...pedidoBase, id: '1', codigo: 'CP-0042', estado: 'COLA', total: 14, subtotal: 14, lineas, ...over }) as unknown as Pedido;

  it('con 2 unidades abre el diálogo y guarda la cantidad que se elige', async () => {
    const alCambiarLlevar = vi.fn(async () => {});
    const l = linea({});
    render(<CapaProductos pedido={pedidoCon([l])} puedeDarCortesia={false} alCortesia={vi.fn()} puedeCambiarLlevar alCambiarLlevar={alCambiarLlevar} />);
    fireEvent.click(screen.getByTestId('cambiar-para-llevar'));
    fireEvent.click(screen.getByTestId('llevar-mas'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(alCambiarLlevar).toHaveBeenCalledWith(expect.objectContaining({ id: '21' }), 1);
    await vi.waitFor(() => expect(screen.queryByTestId('dialogo-cuantos-llevar')).toBeNull());
  });

  it('con 1 unidad alterna la marca sin diálogo', () => {
    const alCambiarLlevar = vi.fn(async () => {});
    render(<CapaProductos pedido={pedidoCon([linea({ cantidad: 1, paraLlevar: false })])} puedeDarCortesia={false} alCortesia={vi.fn()} puedeCambiarLlevar alCambiarLlevar={alCambiarLlevar} />);
    fireEvent.click(screen.getByTestId('cambiar-para-llevar'));
    expect(alCambiarLlevar).toHaveBeenCalledWith(expect.objectContaining({ id: '21' }), 1);
    expect(screen.queryByTestId('dialogo-cuantos-llevar')).toBeNull();
  });

  it('una línea de combo no es editable: solo el chip de lectura', () => {
    const padre = linea({ id: '30', nombre: 'Combo', cantidad: 1, producto_id: null, oferta_id: '9' });
    const hija = linea({ id: '31', nombre: 'Frappe', linea_combo_id: '30', paraLlevar: true });
    render(<CapaProductos pedido={pedidoCon([padre, hija])} puedeDarCortesia={false} alCortesia={vi.fn()} puedeCambiarLlevar alCambiarLlevar={vi.fn()} />);
    expect(screen.queryByTestId('cambiar-para-llevar')).toBeNull();
  });

  it('sin permiso (o con pedido cerrado) el chip sigue siendo de solo lectura', () => {
    render(<CapaProductos pedido={pedidoCon([linea({ paraLlevar: true })])} puedeDarCortesia={false} alCortesia={vi.fn()} puedeCambiarLlevar={false} alCambiarLlevar={vi.fn()} />);
    expect(screen.queryByTestId('cambiar-para-llevar')).toBeNull();
    expect(screen.getByTestId('chip-para-llevar')).toBeInTheDocument();
  });

  it('si el servidor rechaza el cambio, muestra el error en la capa', async () => {
    const alCambiarLlevar = vi.fn(async () => {
      throw new Error('Ya hay unidades listas en cocina');
    });
    render(<CapaProductos pedido={pedidoCon([linea({ cantidad: 1 })])} puedeDarCortesia={false} alCortesia={vi.fn()} puedeCambiarLlevar alCambiarLlevar={alCambiarLlevar} />);
    fireEvent.click(screen.getByTestId('cambiar-para-llevar'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya hay unidades listas en cocina');
  });
});
