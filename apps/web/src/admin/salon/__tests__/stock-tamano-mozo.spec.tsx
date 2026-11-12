import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import type { ProductoCarta } from '../../../carta/tipos';

const producto = (quedan: number | null): ProductoCarta => ({
  id: '7',
  nombre: 'Galleta de avena',
  descripcion: null,
  fotoUrl: null,
  precio: 6,
  tamanos: [
    { id: 'u', nombre: 'Unidad', precio: 6, unidades: 1 },
    { id: 'm', nombre: '1/2 docena', precio: 30, unidades: 6 },
  ],
  grupos: [],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: true,
  quedan,
});

const renderMozo = (p: ProductoCarta, enCarrito = 0) =>
  render(<VentanaOpcionesProducto producto={p} alCerrar={() => {}} alAgregar={vi.fn()} enCarrito={enCarrito} />);

describe('mozo: stock por tamaño', () => {
  it('1/2 docena (6) con 2 que quedan se muestra deshabilitada con «Solo quedan 2»', () => {
    renderMozo(producto(2));
    const media = screen.getByRole('button', { name: /1\/2 docena/ }) as HTMLButtonElement;
    expect(media.disabled).toBe(true);
    expect(media.textContent).toContain('Solo quedan 2');
    expect((screen.getByRole('button', { name: /^Unidad/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('ultimos-ventana').textContent).toBe('¡Últimas 2!');
  });

  it('con unidades ya en el pedido, el + se bloquea y Agregar sigue activo mientras quepa', () => {
    renderMozo(producto(4), 2);
    const mas = screen.getByRole('button', { name: 'Más cantidad' }) as HTMLButtonElement;
    expect(mas.disabled).toBe(false);
    fireEvent.click(mas);
    expect(mas.disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Agregar al pedido/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sin unidades libres, avisa que no hay stock y Agregar dice «Sin stock» sin dejar agregar', () => {
    renderMozo(producto(4), 4);
    // los dos tamaños marcan que no alcanza
    expect(screen.getAllByRole('button', { name: /No hay stock suficiente/ })).toHaveLength(2);
    expect(screen.getByTestId('aviso-stock').textContent).toContain('No hay stock de');
    expect((screen.getByRole('button', { name: /Sin stock/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
