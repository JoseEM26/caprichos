import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CarritoProvider } from '../CarritoContext';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta } from '../tipos';

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

const base: ProductoCarta = {
  id: '1',
  nombre: 'DÚO PARA COMPARTIR',
  descripcion: null,
  fotoUrl: null,
  precio: 20,
  tamanos: [],
  grupos: [],
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

describe('combo con opciones agotadas por stock (carta web)', () => {
  it('la opción agotada se ve bloqueada y el paso muestra el plan B', () => {
    renderVentana({
      ...base,
      grupos: [
        {
          id: '11',
          nombre: 'Complemento 1 · Complemento',
          obligatorio: true,
          minimo: 1,
          maximo: 1,
          aviso: 'Se acabaron: 2 Donas. Elige entre: Oreo',
          sinStock: false,
          opciones: [
            { id: '111', nombre: '2 Donas', precioExtra: 0, disponible: false },
            { id: '112', nombre: 'Oreo', precioExtra: 0, disponible: true },
          ],
        },
      ],
    });
    expect(screen.getByText('Se acabaron: 2 Donas. Elige entre: Oreo')).toBeTruthy();
    expect((screen.getByRole('button', { name: /^2 Donas/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '✓ Oreo' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('un paso sin ninguna opción pedible deja el combo como «No disponible» y no se puede agregar', () => {
    renderVentana({
      ...base,
      disponible: false,
      grupos: [
        {
          id: '12',
          nombre: 'Dona 1 · Sabor',
          obligatorio: true,
          minimo: 1,
          maximo: 1,
          aviso: null,
          sinStock: true,
          opciones: [{ id: '121', nombre: 'Fresa', precioExtra: 0, disponible: false }],
        },
      ],
    });
    const boton = screen.getByText('No disponible').closest('button') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });
});
