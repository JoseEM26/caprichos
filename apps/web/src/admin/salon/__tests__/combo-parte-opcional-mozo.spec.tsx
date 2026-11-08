import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';
import { OfertaItem } from '../../ofertas/ofertasApi';

const producto: ProductoCarta = {
  id: '19', nombre: 'DÚO IRRESISTIBLE', descripcion: null, fotoUrl: null, precio: 30, tamanos: [], sabores: [], grupos: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

const oferta = {
  id: '4', tipo: 'COMBO', nombre: 'Dúo Irresistible', alcanceProductoId: '19', activo: true, disponible: true,
  combosParte: [
    { id: '1', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], principalNombre: 'CLUB SANDWICH', disponible: true, opcionesDisponibles: ['5'] },
    {
      id: '2', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['6'], principalNombre: 'PAPAS NATIVAS', disponible: true, opcionesDisponibles: ['6'],
      opcional: true, cantidadMin: 0, cantidadMax: 3, incluidaPorDefecto: true, precioExtra: 6,
    },
  ],
} as unknown as OfertaItem;

describe('Mozo/caja: combo con parte opcional', () => {
  it('quita las papas y la elección viaja con cantidad 0', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={producto} oferta={oferta} alCerrar={() => {}} alAgregar={alAgregar} />);
    expect(screen.getByTestId('parte-opcional-2')).toHaveTextContent('✓ Incluida');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno: PAPAS NATIVAS' }));
    expect(screen.getByTestId('parte-opcional-2')).toHaveTextContent('Sin papas nativas');
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    expect(alAgregar.mock.calls[0][0].comboElecciones).toEqual([
      { parteId: '1', productoId: '5' },
      { parteId: '2', productoId: '6', cantidad: 0 },
    ]);
  });

  it('un extra suma S/ 6.00 al total de la línea y viaja cantidad 2', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={producto} oferta={oferta} alCerrar={() => {}} alAgregar={alAgregar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar uno: PAPAS NATIVAS' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    const l = alAgregar.mock.calls[0][0];
    expect(l.comboElecciones).toContainEqual({ parteId: '2', productoId: '6', cantidad: 2 });
    expect(l.precioTotal).toBe(36);
  });
});
