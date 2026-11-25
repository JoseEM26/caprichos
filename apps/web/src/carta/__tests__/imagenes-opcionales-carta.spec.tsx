import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { SelectorSaboresMezcla } from '../../comun/SelectorSaboresMezcla';
import { saboresConFoto, fotoPrincipal } from '../../comun/fotosOpcionales';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
const botonAgregar = () => screen.getByRole('button', { name: /Agregar al pedido|Falta elegir|Elige las opciones obligatorias/ });
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const base = {
  descripcion: null, sabores: [], grupos: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

/** Combo Cajita por tamaño: Personal = 2 juguetes, Familiar = 4; cada tamaño con su foto y descripción. */
const producto = {
  ...base, id: '9', nombre: 'CAJITA', fotoUrl: '/archivos/cajita.jpg', precio: 27, descripcion: 'Del combo',
  tamanos: [
    { id: 't7', tamanoValorId: '7', nombre: 'Personal', precio: 27 },
    { id: 't8', tamanoValorId: '8', nombre: 'Familiar', precio: 50 },
  ],
} as ProductoCarta;

const oferta = (mostrarImagenes: boolean): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'CAJITA', alcanceProductoId: '9', canales: ['CARTA'], activo: true, disponible: true,
    combosPrecio: [
      { tamanoValorId: '7', tamanoNombre: 'Personal', precio: 27, descripcion: null, fotoUrl: null, cantidades: {} },
      { tamanoValorId: '8', tamanoNombre: 'Familiar', precio: 50, descripcion: 'Para 4 personas', fotoUrl: '/archivos/familiar.jpg', cantidades: { '200': 4 } },
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

const abrir = (o: OfertaItem | null, p: ProductoCarta = producto) => render(<VentanaProductoCarta producto={p} esBebida={false} onCerrar={() => {}} oferta={o} />);
const fotoGrande = () => (screen.getByTestId('cuerpo-ventana').querySelector('img[alt="CAJITA"]') as HTMLImageElement | null)?.getAttribute('src');

describe('Carta: combo por tamaño', () => {
  it('Personal pide 2 y Familiar pide 4: cambian el contador y la validación', () => {
    abrir(oferta(false));
    expect(screen.getByText('Elige 2 opciones')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Oso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Auto' }));
    expect(botonAgregar()).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Familiar/ }));
    expect(screen.getByText('Elige 4 opciones')).toBeInTheDocument();
    expect(screen.getByText('2 de 4 elegidas')).toBeInTheDocument();
    expect(botonAgregar()).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Oso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Oso' }));
    expect(botonAgregar()).toBeEnabled();
  });

  it('al elegir el tamaño cambian la foto y la descripción; sin dato propio queda la del combo', () => {
    abrir(oferta(false));
    expect(fotoGrande()).toBe('/archivos/cajita.jpg');
    expect(screen.getByText('Del combo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Familiar/ }));
    expect(fotoGrande()).toBe('/archivos/familiar.jpg');
    expect(screen.getByText('Para 4 personas')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }));
    expect(fotoGrande()).toBe('/archivos/cajita.jpg');
    expect(screen.getByText('Del combo')).toBeInTheDocument();
  });

  it('con «Mostrar imágenes» los elegibles llevan miniatura (solo el que tiene foto); sin el interruptor, ninguna', () => {
    const { unmount } = abrir(oferta(true));
    const mini = screen.getAllByTestId('miniatura');
    expect(mini).toHaveLength(1);
    expect(mini[0]).toHaveAttribute('src', '/archivos/oso.jpg');
    unmount();
    abrir(oferta(false));
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
  });
});

describe('Carta: imágenes opcionales de producto', () => {
  const bebida = (extra: Partial<ProductoCarta>): ProductoCarta =>
    ({
      ...base, id: '5', nombre: 'FRAPPE', fotoUrl: '/archivos/frappe.jpg', precio: 12,
      tamanos: [
        { id: 'a', tamanoValorId: '1', nombre: 'Regular', precio: 12, fotoUrl: '/archivos/regular.jpg' },
        { id: 'b', tamanoValorId: '2', nombre: 'Grande', precio: 15, fotoUrl: null },
      ],
      ...extra,
    }) as ProductoCarta;
  const foto = () => (screen.getByTestId('cuerpo-ventana').querySelector('img[alt="FRAPPE"]') as HTMLImageElement).getAttribute('src');

  it('con el interruptor, la foto principal es la del tamaño (respaldo: la del producto) y los botones traen miniatura', () => {
    abrir(null, bebida({ mostrarImagenesTamanos: true }));
    expect(foto()).toBe('/archivos/regular.jpg');
    fireEvent.click(screen.getByRole('button', { name: /Grande/ }));
    expect(foto()).toBe('/archivos/frappe.jpg');
    expect(screen.getAllByTestId('miniatura')).toHaveLength(2);
  });

  it('sin el interruptor todo queda como hoy: foto del producto y sin miniaturas', () => {
    abrir(null, bebida({}));
    expect(foto()).toBe('/archivos/frappe.jpg');
    fireEvent.click(screen.getByRole('button', { name: /Regular/ }));
    expect(foto()).toBe('/archivos/frappe.jpg');
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
  });

  it('las opciones de un grupo con «Mostrar imágenes» llevan su foto; sin interruptor no', () => {
    const grupo = (mostrarImagenes: boolean) => ({
      id: 'g1', nombre: 'Sabor', obligatorio: false, minimo: 0, maximo: 1, mostrarImagenes,
      opciones: [{ id: 'o1', nombre: 'Fresa', precioExtra: 0, disponible: true, fotoUrl: '/archivos/fresa.jpg' }, { id: 'o2', nombre: 'Mango', precioExtra: 0, disponible: true }],
    });
    const { unmount } = abrir(null, bebida({ tamanos: [], grupos: [grupo(true)] }));
    // Fresa con su foto y Mango con la del producto
    expect(screen.getAllByTestId('miniatura').map((i) => i.getAttribute('src'))).toEqual(['/archivos/fresa.jpg', '/archivos/frappe.jpg']);
    unmount();
    abrir(null, bebida({ tamanos: [], grupos: [grupo(false)] }));
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
  });

  it('sabores: con el interruptor llevan su foto (respaldo la del producto); apagado, el selector no cambia', () => {
    const p = bebida({ mostrarImagenesSabores: true, sabores: [{ id: 's1', nombre: 'Fresa', disponible: true, fotoUrl: '/archivos/fresa.jpg' }, { id: 's2', nombre: 'Limón', disponible: true }] });
    const sabores = [{ id: 's1', nombre: 'Fresa', disponible: true, quedan: null }, { id: 's2', nombre: 'Limón', disponible: true, quedan: null }];
    const con = saboresConFoto(sabores, p);
    expect(con.map((s) => s.fotoUrl)).toEqual(['/archivos/fresa.jpg', '/archivos/frappe.jpg']);
    expect(saboresConFoto(sabores, { ...p, mostrarImagenesSabores: false })).toBe(sabores);
    expect(fotoPrincipal(p, null)).toBe('/archivos/frappe.jpg');

    const { unmount } = render(<SelectorSaboresMezcla sabores={con} total={6} valor={{}} onCambio={() => {}} />);
    expect(screen.getAllByTestId('miniatura')).toHaveLength(2);
    unmount();
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{}} onCambio={() => {}} />);
    expect(screen.queryAllByTestId('miniatura')).toHaveLength(0);
  });
});
