import { describe, it, expect } from 'vitest';
sessionStorage.setItem('caprichos.nombreInvitado', 'Invitado');
import { render, screen, fireEvent } from '@testing-library/react';
import { PrevisualizacionCarta } from '../PrevisualizacionCarta';
import { partesParaVistaPrevia } from '../partesVistaPrevia';
import type { OfertaItem } from '../ofertasApi';

const productos = [
  { id: '1', nombre: 'Carrito', categoria: 'Juguetes', precio: 0, fotoUrl: '/f/carrito.png' },
  { id: '2', nombre: 'Muneca', categoria: 'Juguetes', precio: 0, fotoUrl: '/f/muneca.png' },
  { id: '3', nombre: 'Frappe Oreo', categoria: 'Frappes', precio: 12 },
];
const categorias = [
  { id: '10', nombre: 'Juguetes' },
  { id: '11', nombre: 'Frappes' },
];

const combo = (mostrarImagenes: boolean): Partial<OfertaItem> => ({
  id: '5',
  tipo: 'COMBO',
  nombre: 'Cajita',
  activo: true,
  combosPrecio: [
    { tamanoValorId: '1', tamanoNombre: 'Chica', precio: 20 },
    { tamanoValorId: '2', tamanoNombre: 'Grande', precio: 30, descripcion: 'La cajita grande' },
  ],
  combosParte: [
    { id: 'u1', tipo: 'A_ELECCION', cantidad: 1, categorias: ['10'], productos: ['1', '2'], mostrarImagenes, cantidadPorTamano: { '1': 1, '2': 2 } },
  ],
});

const abrir = (c: Partial<OfertaItem>) => {
  render(<PrevisualizacionCarta oferta={c} productosDisponibles={productos} categoriasDisponibles={categorias} vistaInicial="abierta" dispositivoInicial="pc" />);
  fireEvent.click(screen.getByRole('button', { name: /^Chica/ }));
};

describe('vista previa del combo igual a la carta', () => {
  it('con 2 tamanos: «Elige N» cambia al elegir el tamano y los juguetes llevan miniatura', () => {
    abrir(combo(true));
    expect(screen.getByText('Elige 1 opción')).toBeInTheDocument();
    expect(screen.getAllByTestId('miniatura')).toHaveLength(2);
    // volver al paso del tamano y elegir Grande: la cantidad propia del tamano
    fireEvent.click(screen.getByRole('button', { name: /^Paso 1: Tamaño/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Grande/ }));
    expect(screen.getByText('Elige 2 opciones')).toBeInTheDocument();
  });

  it('sin «Mostrar imagenes» no hay miniaturas; la vista es de solo lectura', () => {
    abrir(combo(false));
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /Vista previa/i })).toBeDisabled();
  });
});

describe('partesParaVistaPrevia', () => {
  it('arma opcionesDetalle, marca bebidas por categoria y respeta lo que ya trae el servidor', () => {
    const [a, b, c] = partesParaVistaPrevia(
      [
        { tipo: 'A_ELECCION', cantidad: 1, categorias: ['Juguetes'], productos: [], cuposProducto: { '2': 2 } },
        { tipo: 'A_ELECCION', cantidad: 2, categorias: ['11'], productos: [] },
        { id: '9', tipo: 'A_ELECCION', cantidad: 1, categorias: [], productos: [], opcionesDetalle: [{ id: 'x', nombre: 'X', disponible: false }] },
      ],
      productos,
      categorias,
    );
    expect(a.opcionesDetalle?.map((o) => o.nombre)).toEqual(['Carrito', 'Muneca']);
    expect(a.opcionesDetalle?.[1].cupos).toBe(2);
    expect(a.bebidas).toBeUndefined();
    expect(b.bebidas).toBe(true);
    expect(c.opcionesDetalle?.[0].disponible).toBe(false);
  });
});
