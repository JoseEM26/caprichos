import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { CajonCarrito } from '../CajonCarrito';
import { TarjetaProducto } from '../TarjetaProducto';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta, LineaCarrito } from '../tipos';
import {
  etiquetaQuedan,
  etiquetaUltimos,
  UMBRAL_ULTIMOS,
  excesosDeStock,
  infoStockDe,
  recortarLineasProducto,
  stockInsuficienteDe,
  topeAgregable,
  unidadesEnCarrito,
} from '../stock';

// el cajón llama a /carta al abrirse: aquí no hay red
vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

const base: ProductoCarta = {
  id: '1',
  nombre: 'Dona de chocolate',
  descripcion: null,
  fotoUrl: null,
  precio: 6,
  tamanos: [],
  grupos: [],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

const conStock = (quedan: number | null, extra: Partial<ProductoCarta> = {}): ProductoCarta => ({
  ...base,
  controlaStock: true,
  quedan,
  ...extra,
});

const linea = (id: string, productoId: string, cantidad: number, nombre = 'Dona de chocolate'): LineaCarrito => ({
  id,
  productoId,
  nombre,
  precioBase: 6,
  cantidad,
  opciones: [],
  precioUnitario: 6,
  subtotal: 6 * cantidad,
});

const sembrarCarrito = (lineas: LineaCarrito[]) => sessionStorage.setItem('caprichos_carrito', JSON.stringify(lineas));

beforeEach(() => sessionStorage.clear());

describe('lógica de stock (stock.ts)', () => {
  it('franja «¡Últimos N!» solo con 1 a 3 unidades; «Quedan N» entre 4 y 5; nada en 0, sobre el umbral o sin control', () => {
    expect(UMBRAL_ULTIMOS).toBe(3);
    expect([3, 2, 1].map((n) => etiquetaUltimos(infoStockDe(conStock(n))))).toEqual(['¡Últimos 3!', '¡Últimos 2!', '¡Últimos 1!']);
    expect(etiquetaUltimos(infoStockDe(conStock(4)))).toBeNull();
    expect(etiquetaUltimos(infoStockDe(conStock(0)))).toBeNull();
    expect(etiquetaUltimos(infoStockDe({ ...base, quedan: 2 }))).toBeNull();
    expect(etiquetaQuedan(infoStockDe(conStock(4)))).toBe('Quedan 4');
    expect(etiquetaQuedan(infoStockDe(conStock(3)))).toBeNull();
    expect(etiquetaQuedan(infoStockDe(conStock(0)))).toBeNull();
    expect(etiquetaQuedan(infoStockDe(conStock(12)))).toBeNull();
    expect(etiquetaQuedan(infoStockDe(conStock(null)))).toBeNull();
    expect(etiquetaQuedan(infoStockDe({ ...base, quedan: 4 }))).toBeNull();
  });

  it('unidades: un tamaño de 6 consume 6 del saldo, no 1', () => {
    const media: LineaCarrito = { ...linea('m', '1', 2), unidadesTamano: 6 };
    expect(unidadesEnCarrito([media], '1')).toBe(12);
    expect(excesosDeStock([media], { '1': infoStockDe(conStock(10)) })).toEqual([
      { productoId: '1', nombre: 'Dona de chocolate', pedidas: 12, quedan: 10 },
    ]);
    // ajustar a 10 unidades deja 1 media docena (6) y no parte la línea
    expect(recortarLineasProducto([media], '1', 10).map((l) => l.cantidad)).toEqual([1]);
  });

  it('tope: el saldo lo comparten todas las líneas del mismo producto', () => {
    const lineas = [linea('a', '1', 2), linea('b', '2', 4), linea('c', '1', 1)];
    expect(unidadesEnCarrito(lineas, '1')).toBe(3);
    expect(topeAgregable(infoStockDe(conStock(5)), 3)).toBe(2);
    expect(topeAgregable(infoStockDe(conStock(2)), 3)).toBe(0);
    expect(topeAgregable(infoStockDe(base), 3)).toBeNull();
  });

  it('galleta por tamaño: 1/2 docena cuenta 6 unidades del saldo, no 1', () => {
    const media = { ...linea('a', '1', 1), unidadesTamano: 6 };
    expect(unidadesEnCarrito([media], '1')).toBe(6);
    expect(topeAgregable(infoStockDe(conStock(12)), 6, 6)).toBe(1);
    expect(topeAgregable(infoStockDe(conStock(5)), 0, 6)).toBe(0);
    const recortado = recortarLineasProducto([{ ...linea('a', '1', 2), unidadesTamano: 6 }], '1', 7);
    expect(recortado[0].cantidad).toBe(1);
  });

  it('excesos: marca el producto cuya suma supera quedan y no toca los demás', () => {
    const inv = { '1': infoStockDe(conStock(4)), '2': infoStockDe(conStock(null)) };
    const lineas = [linea('a', '1', 3), linea('b', '1', 2), linea('c', '2', 9)];
    expect(excesosDeStock(lineas, inv)).toEqual([{ productoId: '1', nombre: 'Dona de chocolate', pedidas: 5, quedan: 4 }]);
    expect(excesosDeStock([linea('a', '1', 4)], inv)).toEqual([]);
  });

  it('ajuste: recorta desde la última línea y quita las que llegan a 0', () => {
    const lineas = [linea('a', '1', 2), linea('b', '2', 4), linea('c', '1', 3)];
    const parcial = recortarLineasProducto(lineas, '1', 3);
    expect(parcial.map((l) => [l.id, l.cantidad])).toEqual([['a', 2], ['b', 4], ['c', 1]]);
    expect(parcial[2].subtotal).toBe(6);
    const sinNada = recortarLineasProducto(lineas, '1', 0);
    expect(sinNada.map((l) => l.id)).toEqual(['b']);
  });

  it('409 STOCK_INSUFICIENTE: lee producto y quedan; otros errores no cuentan', () => {
    const e = new ErrorApi('STOCK_INSUFICIENTE', 'Solo quedan 2 de Dona de chocolate', 409, {
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: 'Solo quedan 2 de Dona de chocolate',
      productoId: 1,
      quedan: 2,
    });
    expect(stockInsuficienteDe(e)).toEqual({ productoId: '1', quedan: 2, mensaje: 'Solo quedan 2 de Dona de chocolate' });
    expect(stockInsuficienteDe(new ErrorApi('PRODUCTO_AGOTADO', 'Agotado', 409))).toBeNull();
    expect(stockInsuficienteDe(new Error('red'))).toBeNull();
  });
});

describe('tarjeta de producto', () => {
  const renderTarjeta = (p: ProductoCarta) =>
    render(
      <CarritoProvider>
        <TarjetaProducto producto={p} />
      </CarritoProvider>,
    );

  it('quedan 3 muestra la franja «¡Últimos 3!»', () => {
    renderTarjeta(conStock(3));
    expect(screen.getByTestId('ultimos-1').textContent).toBe('¡Últimos 3!');
    expect(screen.getByRole('button', { name: 'Pedir Dona de chocolate' })).toBeTruthy();
  });

  it('quedan 1 muestra «¡Últimos 1!»', () => {
    renderTarjeta(conStock(1));
    expect(screen.getByText('¡Últimos 1!')).toBeTruthy();
  });

  it('quedan 4 muestra «Quedan 4» y no la franja', () => {
    renderTarjeta(conStock(4));
    expect(screen.getByText('Quedan 4')).toBeTruthy();
    expect(screen.queryByTestId('ultimos-1')).toBeNull();
  });

  it('quedan 0 queda agotada, sin etiqueta', () => {
    renderTarjeta(conStock(0));
    expect(screen.queryByText(/Quedan|Últimos/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Dona de chocolate agotado' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('quedan 12 no muestra etiqueta', () => {
    renderTarjeta(conStock(12));
    expect(screen.queryByText(/Quedan|Últimos/)).toBeNull();
  });

  it('sin controlaStock no cambia nada aunque traiga quedan', () => {
    renderTarjeta({ ...base, quedan: 3 });
    expect(screen.queryByText(/Quedan|Últimos/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Pedir Dona de chocolate' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('ventana de producto', () => {
  const renderVentana = (p: ProductoCarta) =>
    render(
      <CarritoProvider>
        <VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} />
      </CarritoProvider>,
    );
  // el nombre accesible del botón incluye el precio: se busca por el texto del inicio
  const boton = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) }) as HTMLButtonElement;

  it('el + se deshabilita al llegar a quedan y lo dice', () => {
    renderVentana(conStock(3));
    fireEvent.click(boton('Más'));
    fireEvent.click(boton('Más'));
    expect(screen.getByText('3', { selector: 'span' })).toBeTruthy();
    expect(boton('Más').disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toBe('Solo quedan 3');
  });

  it('suma lo que ya hay en el carrito de la misma línea de producto', () => {
    sembrarCarrito([linea('a', '1', 2)]);
    renderVentana(conStock(3));
    expect(boton('Más').disabled).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('ya tienes 2 en tu pedido');
    expect(boton('Agregar al pedido').disabled).toBe(false);
  });

  it('con todo el saldo ya en el carrito no deja agregar más', () => {
    sembrarCarrito([linea('a', '1', 2), linea('b', '1', 1)]);
    renderVentana(conStock(3));
    expect(boton('Sin más unidades').disabled).toBe(true);
  });

  it('quedan 0 muestra Agotado', () => {
    renderVentana(conStock(0));
    expect(boton('Agotado').disabled).toBe(true);
  });

  const tamanos = [
    { id: 'u', nombre: 'Unidad', precio: 6, unidades: 1 },
    { id: 'm', nombre: '1/2 docena', precio: 30, unidades: 6 },
  ];

  it('franja «¡Últimos N!» en la ventana con 3, 2 y 1; no con 4 ni 0', () => {
    for (const n of [3, 2, 1]) {
      const { unmount } = render(
        <CarritoProvider>
          <VentanaProductoCarta producto={conStock(n)} esBebida={false} onCerrar={() => {}} />
        </CarritoProvider>,
      );
      expect(screen.getByTestId('ultimos-ventana').textContent).toBe(`¡Últimos ${n}!`);
      unmount();
    }
    const { unmount } = render(
      <CarritoProvider>
        <VentanaProductoCarta producto={conStock(4)} esBebida={false} onCerrar={() => {}} />
      </CarritoProvider>,
    );
    expect(screen.queryByTestId('ultimos-ventana')).toBeNull();
    unmount();
  });

  it('tamaño de 1/2 docena (6) con 2 que quedan: deshabilitado con «Solo quedan 2»; agregar bloqueado si está elegido', () => {
    renderVentana(conStock(2, { tamanos }));
    const media = screen.getByRole('button', { name: /1\/2 docena/ }) as HTMLButtonElement;
    expect(media.disabled).toBe(true);
    expect(media.textContent).toContain('Solo quedan 2');
    expect((screen.getByRole('button', { name: /^Unidad/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(boton('Agregar al pedido').disabled).toBe(false);
  });

  it('sin unidades libres, los tamaños dicen «No hay stock suficiente» y no se pueden agregar', () => {
    sembrarCarrito([{ ...linea('a', '1', 4), unidadesTamano: 1 }]);
    renderVentana(conStock(4, { tamanos }));
    // dos tamaños (Unidad y 1/2 docena) y el botón Agregar
    expect(screen.getAllByText('No hay stock suficiente')).toHaveLength(3);
    expect((screen.getByRole('button', { name: /1\/2 docena/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(boton('No hay stock suficiente').disabled).toBe(true);
  });

  it('tamaño de 1/2 docena con 5 que quedan: deshabilitado y «Solo quedan 5»', () => {
    renderVentana(conStock(5, { tamanos }));
    expect((screen.getByRole('button', { name: /1\/2 docena/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Solo quedan 5')).toBeTruthy();
  });

  it('con unidades ya en el carrito, el + y Agregar se bloquean al superar lo que queda', () => {
    sembrarCarrito([{ ...linea('a', '1', 1), unidadesTamano: 1 }]);
    renderVentana(conStock(4, { tamanos }));
    // quedan 4, en carrito 1 unidad: 3 libres (no caben 6); la Unidad admite hasta 3
    expect(boton('Más').disabled).toBe(false);
    fireEvent.click(boton('Más'));
    fireEvent.click(boton('Más'));
    expect(boton('Más').disabled).toBe(true);
    expect(boton('Agregar al pedido').disabled).toBe(false);
  });

  it('sin controlaStock el selector no tiene tope', () => {
    renderVentana({ ...base, quedan: 1 });
    for (let i = 0; i < 4; i++) fireEvent.click(boton('Más'));
    expect(boton('Más').disabled).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    expect(boton('Agregar al pedido').disabled).toBe(false);
  });
});

describe('cajón del carrito', () => {
  // Carga el stock de la carta y abre el cajón, como hace la carta pública
  function Cajon({ productos }: { productos: ProductoCarta[] }) {
    const { aplicarCarta, abrirCajon } = useCarrito();
    useEffect(() => {
      aplicarCarta(productos);
      abrirCajon();
    }, []);
    return <CajonCarrito estadoLocal={null} />;
  }

  it('si el saldo bajó, avisa en cada línea del producto y bloquea Continuar', () => {
    sembrarCarrito([linea('a', '1', 2), linea('b', '1', 2), linea('c', '2', 1, 'Galleta')]);
    render(
      <CarritoProvider>
        <Cajon productos={[conStock(3), { ...base, id: '2', nombre: 'Galleta' }]} />
      </CarritoProvider>,
    );
    expect(screen.getAllByText('Solo quedan 3: quita unidades de este producto')).toHaveLength(2);
    expect(screen.queryByText(/Solo quedan.*Galleta/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Ajusta las cantidades para continuar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con el tope exacto en el carrito, el + se bloquea con «Solo quedan N» y se puede continuar', () => {
    sembrarCarrito([linea('a', '1', 3)]);
    render(
      <CarritoProvider>
        <Cajon productos={[conStock(3)]} />
      </CarritoProvider>,
    );
    expect(screen.getByText('Solo quedan 3')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Agregar uno más a Dona de chocolate' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^Continuar/ }) as HTMLButtonElement).disabled).toBe(false);
  });
});
