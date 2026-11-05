import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TarjetaOferta } from '../TarjetaOferta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const mockAbrirModal = vi.fn();

vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({
    abrirModalProducto: mockAbrirModal,
    cantidadTotal: 0,
    subtotal: 0,
    lineas: [],
    inventario: {},
  }),
}));

const ofertaSinFoto: OfertaItem = {
  id: '1',
  tipo: 'COMBO',
  nombre: 'Combo Dúo Para Compartir',
  descripcion: '2 bebidas a elección',
  lleva: null,
  paga: null,
  alcanceCategoriaId: null,
  alcanceProductoId: '10',
  descuentoTipo: null,
  descuentoValor: null,
  compraMinima: null,
  dias: [],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 1,
  activo: true,
  creadoEn: '2026-10-22T05:39:18.163Z',
  categoriaNombre: null,
  productoNombre: 'DÚO PARA COMPARTIR',
  vigenteAhora: true,
  imagenArchivoId: null,
  imagenUrl: null,
  combosPrecio: [
    { tamanoValorId: '1', tamanoNombre: 'Regular 12 oz', precio: 33 },
    { tamanoValorId: '2', tamanoNombre: 'Grande 16 oz', precio: 37 },
  ],
  combosParte: [],
};

const ofertaConFoto: OfertaItem = {
  id: '7',
  tipo: 'LLEVA_PAGA',
  nombre: '2x1 LATTE COFFE',
  descripcion: '2x1 en Latte Coffe los martes',
  lleva: 2,
  paga: 1,
  alcanceCategoriaId: null,
  alcanceProductoId: '17',
  descuentoTipo: null,
  descuentoValor: 11.5,
  compraMinima: null,
  dias: [2],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 0,
  activo: true,
  creadoEn: '2026-10-22T17:19:21.066Z',
  categoriaNombre: null,
  productoNombre: 'LATTE COFFE',
  vigenteAhora: false,
  imagenArchivoId: '99',
  imagenUrl: '/archivos/publico/seed/iced_latte_coffee.webp',
  combosPrecio: [],
  combosParte: [],
};

const productoMock: ProductoCarta = {
  id: '10',
  nombre: 'DÚO PARA COMPARTIR',
  descripcion: 'Combo',
  fotoUrl: null,
  precio: 33,
  tamanos: [],
  grupos: [],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

describe('TarjetaOferta en la carta virtual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la letra inicial cuando la oferta no tiene imagen', () => {
    render(
      <TarjetaOferta
        oferta={ofertaSinFoto}
        productos={[productoMock]}
        categorias={[]}
      />
    );

    // Letra inicial "C" de Combo Dúo Para Compartir
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('Combo Dúo Para Compartir')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Desde s/ 33')).toBeInTheDocument();
    expect(screen.getByText('Personalizar')).toBeInTheDocument();
  });

  it('muestra la imagen cuando la oferta tiene imagenUrl', () => {
    render(
      <TarjetaOferta
        oferta={ofertaConFoto}
        productos={[]}
        categorias={[]}
      />
    );

    const imagenes = screen.getAllByRole('img', { hidden: true });
    expect(imagenes.length).toBeGreaterThan(0);
    // Vigencia: hoy no aplica
    const badgesNoAplica = screen.getAllByText('Hoy no aplica');
    expect(badgesNoAplica.length).toBeGreaterThan(0);
    expect(screen.getByText('2x1 LATTE COFFE')).toBeInTheDocument();
    expect(screen.getByText('2x1')).toBeInTheDocument();
  });

  it('abre el modal del producto al hacer clic en Personalizar o Pedir', () => {
    render(
      <TarjetaOferta
        oferta={ofertaSinFoto}
        productos={[productoMock]}
        categorias={[]}
      />
    );

    const boton = screen.getByText('Personalizar');
    fireEvent.click(boton);

    expect(mockAbrirModal).toHaveBeenCalledWith(productoMock);
  });

  it('formatea correctamente una promoción de descuento porcentual', () => {
    const ofertaDescuento: OfertaItem = {
      id: '9',
      tipo: 'DESCUENTO',
      nombre: 'Happy hour de la tarde',
      descripcion: '15 % de descuento en toda la carta',
      lleva: null,
      paga: null,
      alcanceCategoriaId: null,
      alcanceProductoId: null,
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 15,
      compraMinima: 0,
      dias: [1, 2, 3, 4, 5],
      horaDesde: '15:00',
      horaHasta: '17:00',
      fechaDesde: null,
      fechaHasta: null,
      canales: ['CARTA'],
      limiteUsos: null,
      usosActuales: 0,
      noSumaBeneficios: false,
      orden: 0,
      activo: true,
      creadoEn: '2026-10-22T17:19:29.761Z',
      categoriaNombre: null,
      productoNombre: null,
      vigenteAhora: true,
      imagenArchivoId: null,
      imagenUrl: null,
      combosPrecio: [],
      combosParte: [],
    };

    render(
      <TarjetaOferta
        oferta={ofertaDescuento}
        productos={[]}
        categorias={[]}
      />
    );

    expect(screen.getByText('15 % OFF')).toBeInTheDocument();
    expect(screen.getByText('Descuento')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Ver oferta')).toBeInTheDocument();
  });
});
