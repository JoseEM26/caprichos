import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEffect } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorApi } from '../../comun/api';
import { CarritoProvider, useCarrito } from '../CarritoContext';
import { CajonCarrito } from '../CajonCarrito';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { AjusteSaboresLinea } from '../AjusteSaboresLinea';
import { ProductoCarta, LineaCarrito } from '../tipos';
import { excesosDeStock, infoStockDe, lineasSaborIncompletas, saborRechazadoDe, saboresEnCarrito, textoSabores } from '../stock';

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

const sabores: ProductoCarta['sabores'] = [
  { id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 },
  { id: 'o', nombre: 'Oreo', disponible: true, quedan: null },
  { id: 'm', nombre: 'Manjar', disponible: true, quedan: 4 },
];

const dona: ProductoCarta = {
  id: '10',
  nombre: 'Dona',
  descripcion: null,
  fotoUrl: null,
  precio: 18,
  tamanos: [
    { id: 'media', nombre: 'Media docena', precio: 18, unidades: 6 },
    { id: 'docena', nombre: 'Docena', precio: 34, unidades: 12 },
  ],
  grupos: [],
  sabores,
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: true,
  quedan: null,
  saboresConStock: true,
};

const sinSabores: ProductoCarta = { ...dona, id: '20', nombre: 'Torta', saboresConStock: false, sabores: [], tamanos: [], precio: 9 };

const linea = (id: string, productoId: string, cantidad: number, extra: Partial<LineaCarrito> = {}): LineaCarrito => ({
  id,
  productoId,
  nombre: 'Dona',
  precioBase: 18,
  cantidad,
  opciones: [],
  precioUnitario: 18,
  subtotal: 18 * cantidad,
  ...extra,
});

const sembrarCarrito = (lineas: LineaCarrito[]) => sessionStorage.setItem('caprichos_carrito', JSON.stringify(lineas));
const carritoGuardado = (): LineaCarrito[] => JSON.parse(sessionStorage.getItem('caprichos_carrito') ?? '[]');

beforeEach(() => sessionStorage.clear());

const renderVentana = (p: ProductoCarta, onCerrar = () => {}) =>
  render(
    <CarritoProvider>
      <VentanaProductoCarta producto={p} esBebida={false} onCerrar={onCerrar} />
    </CarritoProvider>,
  );

const boton = (nombre: string) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) }) as HTMLButtonElement;

describe('ventana de producto con sabores', () => {
  it('muestra el selector bajo el tamaño y no deja agregar hasta completar el reparto', () => {
    renderVentana(dona);
    expect(screen.getByRole('group', { name: 'Sabores de la mezcla' })).toBeTruthy();
    expect(screen.getByText('Elegidas 0 de 6')).toBeTruthy();
    expect(screen.getByText('Elige los sabores: faltan 6')).toBeTruthy();
    expect(boton('Elige los sabores').disabled).toBe(true);
  });

  it('el total es unidades del tamaño × cantidad, y el payload guarda sabores y unidades por mezcla', () => {
    const onCerrar = vi.fn();
    renderVentana(dona, onCerrar);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    expect(screen.getByText('Completo ✓')).toBeTruthy();
    fireEvent.click(boton('Agregar al pedido'));
    expect(onCerrar).toHaveBeenCalled();
    const [l] = carritoGuardado();
    expect(l.cantidad).toBe(1);
    expect(l.unidadesPorMezcla).toBe(6);
    expect(l.sabores).toEqual([
      { saborId: 'f', cantidad: 2, nombre: 'Fresa' },
      { saborId: 'o', cantidad: 4, nombre: 'Oreo' },
    ]);
    expect(l.unidades).toBeUndefined();
    expect(textoSabores(l)).toBe('2 Fresa · 4 Oreo');
  });

  it('al cambiar de tamaño el reparto se recorta al nuevo total y pide completar lo que falta', () => {
    renderVentana(dona);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    expect(screen.getByText('Elegidas 6 de 6')).toBeTruthy();
    // pasar a docena: el reparto de 6 se mantiene y faltan 6
    fireEvent.click(boton('Docena'));
    expect(screen.getByText('Elegidas 6 de 12')).toBeTruthy();
    expect(screen.getByText('Elige los sabores: faltan 6')).toBeTruthy();
    // volver a media docena: 6 de 6 sigue completo
    fireEvent.click(boton('Media docena'));
    expect(screen.getByText('Elegidas 6 de 6')).toBeTruthy();
  });

  it('al bajar el total se recorta lo que sobra y se conserva el orden de los sabores', () => {
    renderVentana(dona);
    fireEvent.click(boton('Docena'));
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    expect(screen.getByText('Elegidas 12 de 12')).toBeTruthy();
    fireEvent.click(boton('Media docena'));
    expect(screen.getByText('Elegidas 6 de 6')).toBeTruthy();
    expect(screen.getByText('Completo ✓')).toBeTruthy();
    expect(screen.queryByLabelText('Cantidad de Oreo')?.textContent).toBe('0');
  });

  it('la cantidad de mezclas multiplica el total; el + de mezclas no pasa de lo que queda de los sabores', () => {
    // Fresa tiene 9 y Manjar 4: entre los dos caben 13 unidades, o sea 2 mezclas de media docena
    const pocos: ProductoCarta = { ...dona, sabores: [{ id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 }, { id: 'm', nombre: 'Manjar', disponible: true, quedan: 4 }] };
    renderVentana(pocos);
    fireEvent.click(boton('Más'));
    expect(screen.getByText('Elegidas 0 de 12')).toBeTruthy();
    fireEvent.click(boton('Más'));
    expect(boton('Más').disabled).toBe(true);
    expect(screen.getByText('Ya no quedan más unidades de estos sabores')).toBeTruthy();
  });

  it('suma lo que ya hay de ese sabor en el carrito (todas las líneas del producto)', () => {
    sembrarCarrito([linea('a', '10', 1, { tamanoId: 'media', unidadesPorMezcla: 6, sabores: [{ saborId: 'f', cantidad: 8, nombre: 'Fresa' }] })]);
    renderVentana({ ...dona, sabores: [{ id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 }, { id: 'o', nombre: 'Oreo', disponible: true, quedan: null }] });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    expect((screen.getByRole('button', { name: 'Agregar una de Fresa' }) as HTMLButtonElement).disabled).toBe(true);
    // lo que queda de Fresa es 1; con 6 hay que completar con Oreo (5 más)
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    expect(screen.getByText('Completo ✓')).toBeTruthy();
  });

  it('el atajo «Todas del mismo sabor» no ofrece un sabor que no alcanza para el total', () => {
    renderVentana({ ...dona, sabores: [{ id: 'f', nombre: 'Fresa', disponible: true, quedan: 3 }, { id: 'o', nombre: 'Oreo', disponible: true, quedan: null }] });
    expect((screen.getByRole('button', { name: 'Todas del mismo sabor: Fresa' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Todas del mismo sabor: Oreo' }));
    expect(screen.getByText('Completo ✓')).toBeTruthy();
  });
});

describe('productos sin saboresConStock', () => {
  it('no cambian: sin selector, sin sabores en la línea y con unidades como siempre', () => {
    renderVentana(sinSabores);
    expect(screen.queryByRole('group', { name: 'Sabores de la mezcla' })).toBeNull();
    expect(boton('Agregar al pedido').disabled).toBe(false);
    fireEvent.click(boton('Agregar al pedido'));
    const [l] = carritoGuardado();
    expect(l.sabores).toBeUndefined();
    expect(l.unidadesPorMezcla).toBeUndefined();
    expect(l.unidades).toHaveLength(1);
  });
});

describe('ajuste de sabores y 409', () => {
  // Carga el stock, siembra un sabor agotado con un 409 y abre la ventana de ajuste de la línea
  function Harness({ accion }: { accion: 'sabor-agotado' | 'nada' }) {
    const { aplicarCarta, marcarQuedanSabor, abrirAjusteLinea, lineas, lineaAjustandoId } = useCarrito();
    useEffect(() => {
      aplicarCarta([dona]);
      if (accion === 'sabor-agotado') {
        const r = saborRechazadoDe(
          new ErrorApi('SABOR_AGOTADO', 'agotado', 409, { codigo: 'SABOR_AGOTADO', productoId: 10, saborId: 'f', saborNombre: 'Fresa' }),
        );
        if (r) marcarQuedanSabor(r.productoId, r.saborId, r.quedan);
        abrirAjusteLinea(lineas[0].id);
      }
    }, []);
    return (
      <>
        <span>{lineaAjustandoId ? 'ajustando' : 'cerrado'}</span>
        {lineaAjustandoId && <AjusteSaboresLinea />}
      </>
    );
  }

  it('409 SABOR_AGOTADO deja el sabor en 0 y el ajuste reparte solo con lo que queda', () => {
    sembrarCarrito([linea('a', '10', 1, { unidadesPorMezcla: 6, sabores: [{ saborId: 'f', cantidad: 3, nombre: 'Fresa' }, { saborId: 'o', cantidad: 3, nombre: 'Oreo' }] })]);
    render(
      <CarritoProvider>
        <Harness accion="sabor-agotado" />
      </CarritoProvider>,
    );
    expect(screen.getByRole('dialog', { name: 'Elegir sabores de Dona' })).toBeTruthy();
    // Fresa ya no aparece: el reparto actual (3 Fresa) se recorta y hay que completar con Oreo o Manjar
    expect(screen.queryByLabelText('Cantidad de Fresa')).toBeNull();
    expect(screen.getByText('Elegidas 3 de 6')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Elige todos los sabores' }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Oreo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar sabores' }));
    const [l] = carritoGuardado();
    expect(l.sabores).toEqual([{ saborId: 'o', cantidad: 6, nombre: 'Oreo' }]);
    expect(l.cantidad).toBe(1);
  });

  it('el saldo que baja deja la línea en exceso y «Ajustar» reabre la ventana con lo disponible', () => {
    const inv = { '10': infoStockDe({ ...dona, sabores: [{ id: 'f', nombre: 'Fresa', disponible: true, quedan: 2 }, { id: 'o', nombre: 'Oreo', disponible: true, quedan: null }] }) };
    const lineas = [linea('a', '10', 2, { unidadesPorMezcla: 6, sabores: [{ saborId: 'f', cantidad: 12, nombre: 'Fresa' }] })];
    const exc = excesosDeStock(lineas, inv);
    expect(exc).toEqual([{ productoId: '10', nombre: 'Dona', pedidas: 12, quedan: 2, saborId: 'f', saborNombre: 'Fresa' }]);
    expect(saboresEnCarrito(lineas, '10')).toEqual({ f: 12 });
    expect(lineasSaborIncompletas([linea('b', '10', 1, { unidadesPorMezcla: 6, sabores: [{ saborId: 'o', cantidad: 4 }] })])).toHaveLength(1);
  });

  it('una línea de mezcla incompleta bloquea Continuar y muestra «Elegir sabores»', () => {
    sembrarCarrito([linea('a', '10', 1, { unidadesPorMezcla: 6, sabores: [{ saborId: 'o', cantidad: 4, nombre: 'Oreo' }] })]);
    function Cajon() {
      const { aplicarCarta, abrirCajon } = useCarrito();
      useEffect(() => {
        aplicarCarta([dona]);
        abrirCajon();
      }, []);
      return <CajonCarrito estadoLocal={null} />;
    }
    render(
      <CarritoProvider>
        <Cajon />
      </CarritoProvider>,
    );
    expect(screen.getByText('4 Oreo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elegir sabores' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Ajusta las cantidades para continuar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('bajar la cantidad de una mezcla recorta sus sabores; subirla deja la línea pidiendo elegir', () => {
    sembrarCarrito([linea('a', '10', 2, { unidadesPorMezcla: 6, sabores: [{ saborId: 'f', cantidad: 4, nombre: 'Fresa' }, { saborId: 'o', cantidad: 8, nombre: 'Oreo' }] })]);
    function Cajon() {
      const { aplicarCarta, abrirCajon } = useCarrito();
      useEffect(() => {
        aplicarCarta([dona]);
        abrirCajon();
      }, []);
      return <CajonCarrito estadoLocal={null} />;
    }
    render(
      <CarritoProvider>
        <Cajon />
      </CarritoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno a Dona' }));
    expect(carritoGuardado()[0].sabores).toEqual([
      { saborId: 'f', cantidad: 4, nombre: 'Fresa' },
      { saborId: 'o', cantidad: 2, nombre: 'Oreo' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar uno más a Dona' }));
    expect(carritoGuardado()[0].cantidad).toBe(2);
    expect(screen.getByText('Elige los sabores: faltan 6')).toBeTruthy();
  });
});
