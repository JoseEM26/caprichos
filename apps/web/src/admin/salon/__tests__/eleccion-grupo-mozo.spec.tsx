import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';

const producto: ProductoCarta = {
  id: '1', nombre: 'SUPREMA', descripcion: null, fotoUrl: null, precio: 30,
  tamanos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
  grupos: [
    {
      id: 'g-acomp', nombre: 'Acompañamiento', obligatorio: false, minimo: 0, maximo: 1,
      opciones: [{ id: 'p1', nombre: 'Papas nativas 350 g', precioExtra: 6, disponible: true }],
    },
  ],
};

describe('Ventana de opciones del mozo: grupo opcional de una sola opción', () => {
  it('se marca, se desmarca y el precio vuelve', () => {
    render(<VentanaOpcionesProducto producto={producto} alCerrar={() => {}} alAgregar={vi.fn()} />);
    const boton = screen.getByRole('button', { name: /Papas nativas/ });
    expect(boton).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/36\.00/)).toBeInTheDocument();

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/36\.00/)).toBeNull();
  });
});
