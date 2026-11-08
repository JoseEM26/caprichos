import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';
import { OfertaItem } from '../../ofertas/ofertasApi';

const bebidas = ['ICED COFFE', 'LATTE COFFE', 'ICED CHOCOLATE'];
const grupo = (id: string, nombre: string, ops: string[]) => ({
  id, nombre, obligatorio: true, minimo: 1, maximo: 1,
  opciones: ops.map((n, i) => ({ id: `${id}-${i}`, nombre: n, precioExtra: 0, disponible: true })),
});
// El Dúo real: grupos viejos «Bebida N · Sabor» en el anfitrión Y parte A_ELECCION con lista de bebidas
const producto = {
  id: '19', nombre: 'Dúo Irresistible', descripcion: null, fotoUrl: null, precio: 37, tamanos: [], sabores: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null,
  grupos: [grupo('g1', 'Bebida 1 · Sabor', bebidas), grupo('g2', 'Bebida 2 · Sabor', bebidas)],
} as unknown as ProductoCarta;
const op = (id: string, nombre: string) => ({ id, nombre, disponible: true });
const duo = (bebidasFlag: boolean) =>
  ({
    id: '4', tipo: 'COMBO', nombre: 'Dúo', alcanceProductoId: '19', activo: true, disponible: true,
    combosParte: [{
      id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['101', '102', '103'], alternativas: [], disponible: true,
      ...(bebidasFlag ? { bebidas: true } : {}),
      opcionesDetalle: [op('101', 'ICED COFFE'), op('102', 'LATTE COFFE'), op('103', 'ICED CHOCOLATE')],
    }],
  }) as unknown as OfertaItem;

describe('Nuevo pedido: Dúo sin bebidas duplicadas', () => {
  it('con la parte marcada como bebidas hay UNA sola interfaz, el botón dice qué falta y el payload no lleva los grupos viejos', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={producto} oferta={duo(true)} alCerrar={() => {}} alAgregar={alAgregar} />);
    expect(screen.queryByText(/Bebida \d · Sabor/)).toBeNull();
    expect(screen.queryByText(/Elige 2 opciones/)).toBeNull();
    const boton = () => screen.getByRole('button', { name: /Falta elegir|Agregar al pedido/ });
    expect(boton()).toBeDisabled();
    expect(boton().textContent).toMatch(/Falta elegir: Bebida 1 · Bebida 2/);
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 1' })).getByRole('button', { name: /ICED COFFE/ }));
    expect(boton().textContent).toMatch(/Falta elegir: Bebida 2/);
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 2' })).getByRole('button', { name: /LATTE COFFE/ }));
    expect(boton()).toBeEnabled();
    fireEvent.click(boton());
    const linea = alAgregar.mock.calls[0][0];
    expect(linea.comboElecciones).toEqual([{ parteId: '1', productoId: '101' }, { parteId: '1', productoId: '102' }]);
    expect(linea.opcionesGlobales).toEqual([]);
  });

  it('sin la marca (API vieja, causa del duplicado) salen los grupos viejos Y el contador a la vez', () => {
    render(<VentanaOpcionesProducto producto={producto} oferta={duo(false)} alCerrar={() => {}} alAgregar={() => {}} />);
    expect(screen.getAllByText(/Bebida \d · Sabor/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Elige 2 opci/).length).toBeGreaterThan(0);
  });
});
