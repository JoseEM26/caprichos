import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';
import { OfertaItem } from '../../ofertas/ofertasApi';
import { nombrarVasos } from '../../../carta/__tests__/nombrarVasos';

const grupo = (id: string, nombre: string, opciones: string[]) => ({
  id, nombre, obligatorio: true, minimo: 1, maximo: 1,
  opciones: opciones.map((n, i) => ({ id: `${id}-${i}`, nombre: n, precioExtra: 0, disponible: true })),
});

const producto: ProductoCarta = {
  id: '19', nombre: 'COMBO DUO', descripcion: null, fotoUrl: null, precio: 30, tamanos: [], sabores: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null,
  grupos: [grupo('g1', 'Bebida 1 · Sabor', ['LATTE COFFE']), grupo('g2', 'Bebida 2 · Sabor', ['LATTE COFFE'])],
};

const oferta = {
  id: '4', tipo: 'COMBO', nombre: 'Combo Dúo', alcanceProductoId: '19', activo: true, disponible: true,
  combosParte: [
    {
      id: '1', tipo: 'A_ELECCION', cantidad: 2, categorias: ['4'], productos: [], alternativas: [], disponible: true, bebidas: true,
      opcionesDetalle: [
        { id: '101', nombre: 'FRAPPE OREO', disponible: true },
        { id: '102', nombre: 'ICED COFFE', disponible: true },
      ],
    },
  ],
} as unknown as OfertaItem;

describe('Mozo/caja: combo con bebidas por categoría', () => {
  it('pide Bebida 1 y Bebida 2 de las categorías (no los grupos del anfitrión) y manda la elección', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={producto} oferta={oferta} alCerrar={() => {}} alAgregar={alAgregar} />);
    expect(screen.queryByText(/Bebida 1 · Sabor/)).toBeNull();
    expect(screen.queryByRole('button', { name: /LATTE COFFE/ })).toBeNull();
    // un paso a la vez: la bebida 1 primero; al elegirla, la 2 (y así hasta el resumen)
    expect(screen.getByRole('group', { name: 'Bebida 1' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Bebida 2' })).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 1' })).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 2' })).getByRole('button', { name: /ICED COFFE/ }));
    // ahora el paso de los nombres de los vasos
    nombrarVasos();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); // resumen
    const agregar = screen.getByRole('button', { name: /Agregar al pedido/ });
    expect(agregar).toBeEnabled();
    fireEvent.click(agregar);
    expect(alAgregar.mock.calls[0][0].comboElecciones).toEqual([
      { parteId: '1', productoId: '101' },
      { parteId: '1', productoId: '102' },
    ]);
  });
});
