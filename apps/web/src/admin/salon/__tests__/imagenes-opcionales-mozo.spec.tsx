import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';
import { OfertaItem } from '../../ofertas/ofertasApi';

/** Caja y mozo comparten esta ventana: cantidad por tamaño y miniaturas compactas solo con el interruptor. */
const producto = {
  id: '9', nombre: 'CAJITA', descripcion: 'Del combo', fotoUrl: '/archivos/cajita.jpg', precio: 27, sabores: [], grupos: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
  tamanos: [
    { id: 't7', tamanoValorId: '7', nombre: 'Personal', precio: 27, fotoUrl: '/archivos/personal.jpg' },
    { id: 't8', tamanoValorId: '8', nombre: 'Familiar', precio: 50 },
  ],
} as unknown as ProductoCarta;

const oferta = (mostrarImagenes: boolean): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'CAJITA', alcanceProductoId: '9', canales: ['CARTA'], activo: true, disponible: true,
    combosPrecio: [
      { tamanoValorId: '7', tamanoNombre: 'Personal', precio: 27, descripcion: null, cantidades: {} },
      { tamanoValorId: '8', tamanoNombre: 'Familiar', precio: 50, descripcion: 'Para 4 personas', cantidades: { '200': 4 } },
    ],
    combosParte: [
      {
        id: '200', tipo: 'A_ELECCION', cantidad: 2, cantidadPorTamano: { '8': 4 }, mostrarImagenes, categorias: [], productos: ['30', '31'], alternativas: [],
        opcionesDetalle: [
          { id: '30', nombre: 'Oso', disponible: true, fotoUrl: '/archivos/oso.jpg' },
          { id: '31', nombre: 'Auto', disponible: true },
        ],
      },
    ],
  }) as unknown as OfertaItem;

const abrir = (o: OfertaItem, p: ProductoCarta = producto) => render(<VentanaOpcionesProducto producto={p} oferta={o} alCerrar={() => {}} alAgregar={() => {}} />);

describe('Mozo y caja: combo por tamaño', () => {
  it('Familiar pide 4 y Personal 2; la descripción del tamaño reemplaza a la del combo', () => {
    abrir(oferta(false));
    expect(screen.getByText('Elige 2 opciones')).toBeInTheDocument();
    expect(screen.getByText('Del combo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Familiar/ }));
    expect(screen.getByText('Elige 4 opciones')).toBeInTheDocument();
    expect(screen.getByText('Para 4 personas')).toBeInTheDocument();
    expect(screen.getByText('0 de 4 elegidas')).toBeInTheDocument();
  });

  it('miniaturas solo con el interruptor: en la parte y en los botones de tamaño', () => {
    const { unmount } = abrir(oferta(true), { ...producto, mostrarImagenesTamanos: true } as ProductoCarta);
    // Oso (foto propia) + Personal (foto) + Familiar (respaldo: foto del producto)
    expect(screen.getAllByTestId('miniatura').map((i) => i.getAttribute('src')).sort()).toEqual(['/archivos/cajita.jpg', '/archivos/oso.jpg', '/archivos/personal.jpg']);
    unmount();
    abrir(oferta(false));
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
  });
});
