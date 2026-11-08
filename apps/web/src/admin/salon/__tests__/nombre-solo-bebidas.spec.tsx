import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';

const torta: any = { id: 't1', nombre: 'TORTA DE CHOCOLATE', descripcion: null, fotoUrl: null, precio: 9.5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null };

describe('nombre por vaso: solo bebidas, por categoría', () => {
  it('una torta de chocolate de Postres NO pide nombre', () => {
    render(<VentanaOpcionesProducto producto={torta} categoriaNombre="POSTRES" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.queryByText('¿Para quién es?')).toBeNull();
  });
  it('un producto de Frappes SÍ pide nombre', () => {
    render(<VentanaOpcionesProducto producto={{ ...torta, nombre: 'FRAPPE OREO' }} categoriaNombre="FRAPPES" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.getByText('¿Para quién es?')).toBeTruthy();
  });
});
