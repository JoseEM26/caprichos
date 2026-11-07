import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CarritoProvider } from '../CarritoContext';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta, LineaCarrito } from '../tipos';

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

const dona: ProductoCarta = {
  id: '10',
  nombre: 'Dona',
  descripcion: null,
  fotoUrl: null,
  precio: 5,
  tamanos: [],
  grupos: [],
  sabores: [
    { id: 'f', nombre: 'Fresa', disponible: true, quedan: 3 },
    { id: 'o', nombre: 'Oreo', disponible: true, quedan: null },
    { id: 'm', nombre: 'Manjar', disponible: true, quedan: 0 },
  ],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
  controlaStock: true,
  quedan: null,
  saboresConStock: true,
};

const carritoGuardado = (): LineaCarrito[] => JSON.parse(sessionStorage.getItem('caprichos_carrito') ?? '[]');
beforeEach(() => sessionStorage.clear());

const abrir = (p = dona) =>
  render(
    <CarritoProvider>
      <VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} />
    </CarritoProvider>,
  );
const mas = (s: string, veces = 1) => {
  for (let i = 0; i < veces; i++) fireEvent.click(screen.getByRole('button', { name: `Agregar una de ${s}` }));
};

describe('varios sabores en un solo paso (unidades sueltas)', () => {
  it('sin elegir nada: «Llevas 0», sin selector de cantidad y no se puede agregar', () => {
    abrir();
    expect(screen.getByRole('group', { name: 'Sabores y cantidades' })).toBeTruthy();
    expect(screen.getByText('Llevas 0')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Más' })).toBeNull();
    expect((screen.getByRole('button', { name: /^Elige los sabores/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('suma por sabor, respeta el stock y el agotado, y agrega una línea con el reparto', () => {
    abrir();
    mas('Fresa', 5); // solo quedan 3
    mas('Oreo', 2);
    expect(screen.getByText('Llevas 5')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Agregar una de Fresa' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Agregar una de Manjar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Agregar 5 al pedido/ }));
    const [l] = carritoGuardado();
    expect(l.cantidad).toBe(5);
    expect(l.sabores?.map((s) => [s.saborId, s.cantidad])).toEqual([['f', 3], ['o', 2]]);
  });

  it('quitar con − baja el total', () => {
    abrir();
    mas('Oreo', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar una de Oreo' }));
    expect(screen.getByText('Llevas 1')).toBeTruthy();
  });

  it('con tamaños de varias unidades (docena) sigue el reparto de siempre', () => {
    abrir({ ...dona, tamanos: [{ id: 'd', nombre: 'Docena', precio: 34, unidades: 12 }], sabores: [{ id: 'o', nombre: 'Oreo', disponible: true, quedan: null }] });
    expect(screen.getByRole('group', { name: 'Sabores de la mezcla' })).toBeTruthy();
    expect(screen.getByText('Elegidas 0 de 12')).toBeTruthy();
  });
});
