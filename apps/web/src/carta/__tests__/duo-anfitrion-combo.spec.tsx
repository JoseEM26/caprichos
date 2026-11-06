import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarritoProvider } from '../CarritoContext';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta } from '../tipos';

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

// Lo que manda la carta para un anfitrión de combo (DÚO): sin sabores propios, con sus grupos de combo
const duo: ProductoCarta = {
  id: '70',
  nombre: 'DÚO COMPARTIR',
  descripcion: null,
  fotoUrl: null,
  precio: 30,
  tamanos: [],
  grupos: [
    {
      id: '71',
      nombre: 'Galleta 1 · Sabor',
      obligatorio: true,
      minimo: 1,
      maximo: 1,
      opciones: [{ id: '711', nombre: 'Oreo', precioExtra: 0, disponible: true }],
    },
    {
      id: '72',
      nombre: 'Dona 1 · Sabor',
      obligatorio: true,
      minimo: 1,
      maximo: 1,
      opciones: [
        { id: '721', nombre: 'Fresa', precioExtra: 0, disponible: true },
        { id: '722', nombre: 'Manjar', precioExtra: 0, disponible: true },
      ],
    },
  ],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: false,
  quedan: null,
  saboresConStock: false,
};

const renderVentana = (p: ProductoCarta) =>
  render(
    <CarritoProvider>
      <VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} />
    </CarritoProvider>,
  );

beforeEach(() => sessionStorage.clear());

describe('anfitrión de combo (Dúo) en la carta', () => {
  it('no muestra el selector de mezcla de sabores y arma el combo solo con sus grupos', () => {
    renderVentana(duo);
    expect(screen.queryByText(/Todas del mismo sabor/)).toBeNull();
    expect(screen.queryByText(/Elegidas \d+ de \d+/)).toBeNull();
    // Los pasos del combo sí se muestran y su elección obligatoria ya viene marcada
    expect(screen.getAllByText(/Dona 1/).length).toBeGreaterThan(0);
    const agregar = screen.getByRole('button', { name: /^Agregar al pedido/ }) as HTMLButtonElement;
    expect(agregar.disabled).toBe(false);
    fireEvent.click(agregar);
    const lineas = JSON.parse(sessionStorage.getItem('caprichos_carrito') ?? '[]');
    expect(lineas).toHaveLength(1);
    expect(lineas[0].sabores).toBeUndefined();
  });
});
