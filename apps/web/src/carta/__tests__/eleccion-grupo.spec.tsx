import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { alternarEleccion } from '../eleccionGrupo';
import { ProductoCarta, GrupoOpcionesCarta } from '../tipos';

vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea: vi.fn(), cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const papas = { id: 'p1', nombre: 'Papas nativas 350 g', precioExtra: 6, disponible: true };
const grupoOpcional = (opciones = [papas]): GrupoOpcionesCarta => ({
  id: 'g-acomp', nombre: 'Acompañamiento', obligatorio: false, minimo: 0, maximo: 1, opciones,
});
const producto = (grupos: GrupoOpcionesCarta[]): ProductoCarta => ({
  id: '1', nombre: 'SUPREMA', descripcion: null, fotoUrl: null, precio: 30,
  tamanos: [], grupos, sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
});

describe('alternarEleccion', () => {
  it('opcional de una sola opción: marca y vuelve a quitar', () => {
    const g = { minimo: 0, maximo: 1 };
    expect(alternarEleccion(g, [], 'p1')).toEqual(['p1']);
    expect(alternarEleccion(g, ['p1'], 'p1')).toEqual([]);
  });

  it('obligatorio de máximo 1: elegir otra reemplaza y la elegida no queda vacía', () => {
    const g = { minimo: 1, maximo: 1 };
    expect(alternarEleccion(g, ['a'], 'b')).toEqual(['b']);
    expect(alternarEleccion(g, ['a'], 'a')).toEqual(['a']);
  });

  it('máximo N: se quita al pulsar de nuevo y no pasa del máximo', () => {
    const g = { minimo: 0, maximo: 2 };
    expect(alternarEleccion(g, ['a'], 'b')).toEqual(['a', 'b']);
    expect(alternarEleccion(g, ['a', 'b'], 'c')).toEqual(['a', 'b']);
    expect(alternarEleccion(g, ['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('Ventana de producto en la carta: grupo opcional de una sola opción', () => {
  it('se marca, se desmarca y el precio vuelve', () => {
    render(<VentanaProductoCarta producto={producto([grupoOpcional()])} esBebida={false} onCerrar={() => {}} />);
    const boton = screen.getByRole('button', { name: /Papas nativas/ });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Agregar al pedido/ })).toHaveTextContent('S/ 30.00');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Agregar al pedido/ })).toHaveTextContent('S/ 36.00');

    fireEvent.click(boton);
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Agregar al pedido/ })).toHaveTextContent('S/ 30.00');
  });

  it('obligatorio de máximo 1: pulsar la elegida no la deja vacía', () => {
    const grupo: GrupoOpcionesCarta = {
      id: 'g-tam', nombre: 'Tamaño', obligatorio: true, minimo: 1, maximo: 1,
      opciones: [
        { id: 'o1', nombre: 'Chico', precioExtra: 0, disponible: true },
        { id: 'o2', nombre: 'Familiar', precioExtra: 4, disponible: true },
      ],
    };
    render(<VentanaProductoCarta producto={producto([grupo])} esBebida={false} onCerrar={() => {}} />);
    const chico = screen.getByRole('button', { name: 'Chico' });
    expect(chico).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(chico);
    expect(chico).toHaveAttribute('aria-pressed', 'true');
    const familiar = screen.getByRole('button', { name: /Familiar/ });
    fireEvent.click(familiar);
    expect(chico).toHaveAttribute('aria-pressed', 'false');
    expect(familiar).toHaveAttribute('aria-pressed', 'true');
  });
});
