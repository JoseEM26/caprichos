import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CarritoProvider } from '../CarritoContext';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta } from '../tipos';

vi.mock('../../comun/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('../../comun/api')>();
  return { ...original, api: { ...original.api, get: () => new Promise(() => {}), post: () => new Promise(() => {}) } };
});

const base: ProductoCarta = {
  id: '1', nombre: 'Torta', descripcion: null, fotoUrl: null, precio: 60, tamanos: [], grupos: [], sabores: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};
const ver = (p: ProductoCarta) =>
  render(<CarritoProvider><VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} /></CarritoProvider>);

describe('ficha del producto: porciones y alérgenos', () => {
  it('muestra «Alcanza para» y «Contiene» confirmados', () => {
    ver({ ...base, porciones: '8 a 10 personas', alergenos: ['LACTEOS', 'MANI'], alergenosConfirmados: true });
    expect(screen.getByText('Alcanza para 8 a 10 personas')).toBeTruthy();
    expect(screen.getByText('Contiene: maní, lácteos')).toBeTruthy();
  });
  it('sin confirmar no muestra alérgenos; sin porciones no muestra el alcance', () => {
    ver({ ...base, alergenos: ['MANI'], alergenosConfirmados: false });
    expect(screen.queryByText(/Contiene/)).toBeNull();
    expect(screen.queryByText(/Alcanza para/)).toBeNull();
  });
});
