import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  calcularMapaBeneficios,
  formatearEtiquetaBeneficio,
  esProductoCombo,
} from '../useBeneficiosCarta';
import { TarjetaProducto } from '../TarjetaProducto';
import { CategoriaCarta, ProductoCarta } from '../tipos';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { CarritoProvider } from '../CarritoContext';

const productoCafe: ProductoCarta = {
  id: '10',
  nombre: 'Café Americano',
  descripcion: 'Café de especialidad',
  fotoUrl: null,
  precio: 10,
  tamanos: [],
  grupos: [],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

const productoLatte: ProductoCarta = {
  id: '11',
  nombre: 'Latte Vainilla',
  descripcion: 'Latte con vainilla',
  fotoUrl: null,
  precio: 14,
  tamanos: [],
  grupos: [],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

const productoComboDuo: ProductoCarta = {
  id: '20',
  nombre: 'Combo Dúo para dos',
  descripcion: 'Incluye dos bebidas',
  fotoUrl: null,
  precio: 25,
  tamanos: [],
  grupos: [
    {
      id: 'g1',
      nombre: 'Bebida 1 · Elige tu sabor',
      minimo: 1,
      maximo: 1,
      obligatorio: true,
      opciones: [],
    },
  ],
  sabores: [],
  noSumaBeneficios: false,
  disponible: true,
  agotadoHasta: null,
};

const productoSinBeneficios: ProductoCarta = {
  id: '30',
  nombre: 'Edición Limitada',
  descripcion: 'No aplica a promociones',
  fotoUrl: null,
  precio: 20,
  tamanos: [],
  grupos: [],
  sabores: [],
  noSumaBeneficios: true,
  disponible: true,
  agotadoHasta: null,
};

const categoriasPrueba: CategoriaCarta[] = [
  {
    id: '1',
    nombre: 'Cafetería',
    orden: 1,
    productos: [productoCafe, productoLatte, productoSinBeneficios],
  },
  {
    id: '2',
    nombre: 'Combos',
    orden: 2,
    productos: [productoComboDuo],
  },
];

describe('Insignia en la tarjeta del producto (useBeneficiosCarta y TarjetaProducto)', () => {
  it('1. Formatea etiquetas cortas correctamente sin emojis (2x1 hoy, Lleva 3 paga 2, -15 %)', () => {
    const of2x1: Partial<OfertaItem> = {
      tipo: 'LLEVA_PAGA',
      lleva: 2,
      paga: 1,
    };
    expect(formatearEtiquetaBeneficio(of2x1 as OfertaItem)).toBe('2x1 hoy');

    const of3x2: Partial<OfertaItem> = {
      tipo: 'LLEVA_PAGA',
      lleva: 3,
      paga: 2,
    };
    expect(formatearEtiquetaBeneficio(of3x2 as OfertaItem)).toBe('Lleva 3 paga 2');

    const ofDescPct: Partial<OfertaItem> = {
      tipo: 'DESCUENTO',
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 15,
    };
    expect(formatearEtiquetaBeneficio(ofDescPct as OfertaItem)).toBe('-15 %');

    const ofDescMonto: Partial<OfertaItem> = {
      tipo: 'DESCUENTO',
      descuentoTipo: 'MONTO',
      descuentoValor: 5,
    };
    expect(formatearEtiquetaBeneficio(ofDescMonto as OfertaItem)).toBe('-S/ 5');
  });

  it('2. Producto en promoción vigente muestra la insignia correspondiente', () => {
    const ofertaCafe: OfertaItem = {
      id: 'of1',
      tipo: 'LLEVA_PAGA',
      nombre: '2x1 Café',
      descripcion: null,
      lleva: 2,
      paga: 1,
      alcanceProductoId: '10',
      alcanceCategoriaId: null,
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
      creadoEn: '',
      vigenteAhora: true,
    };

    const mapa = calcularMapaBeneficios([ofertaCafe], categoriasPrueba);
    expect(mapa.get('10')).toBe('2x1 hoy');
    expect(mapa.get('11')).toBeUndefined();

    // Comprobar render en TarjetaProducto
    render(
      <CarritoProvider>
        <TarjetaProducto producto={productoCafe} insigniaBeneficio={mapa.get('10')} />
      </CarritoProvider>,
    );
    const insignia = screen.getByTestId('insignia-beneficio-10');
    expect(insignia).toBeInTheDocument();
    expect(insignia.textContent).toBe('2x1 hoy');
  });

  it('3. Si la oferta existe pero hoy no aplica (vigenteAhora: false), no se muestra', () => {
    const ofertaNoVigente: OfertaItem = {
      id: 'of1',
      tipo: 'LLEVA_PAGA',
      nombre: '2x1 Café',
      descripcion: null,
      lleva: 2,
      paga: 1,
      alcanceProductoId: '10',
      alcanceCategoriaId: null,
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
      creadoEn: '',
      vigenteAhora: false,
    };

    const mapa = calcularMapaBeneficios([ofertaNoVigente], categoriasPrueba);
    expect(mapa.get('10')).toBeUndefined();

    render(
      <CarritoProvider>
        <TarjetaProducto producto={productoCafe} insigniaBeneficio={mapa.get('10')} />
      </CarritoProvider>,
    );
    expect(screen.queryByTestId('insignia-beneficio-10')).toBeNull();
  });

  it('4. REGLA: No aplica a productos con noSumaBeneficios ni a combos', () => {
    const ofertaCategoria: OfertaItem = {
      id: 'of_cat',
      tipo: 'DESCUENTO',
      nombre: '20% en todo Cafetería y Combos',
      descripcion: null,
      lleva: null,
      paga: null,
      alcanceProductoId: null,
      alcanceCategoriaId: '1',
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 20,
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
      creadoEn: '',
      vigenteAhora: true,
    };

    const ofertaCombo: OfertaItem = {
      ...ofertaCategoria,
      alcanceCategoriaId: '2',
      alcanceProductoId: '20',
    };

    const mapa = calcularMapaBeneficios([ofertaCategoria, ofertaCombo], categoriasPrueba);

    // Café y Latte reciben -20 %
    expect(mapa.get('10')).toBe('-20 %');
    expect(mapa.get('11')).toBe('-20 %');

    // Producto marcado con noSumaBeneficios NO recibe insignia
    expect(mapa.get('30')).toBeUndefined();

    // Combo NO recibe insignia
    expect(mapa.get('20')).toBeUndefined();
    expect(esProductoCombo(productoComboDuo, 'Combos')).toBe(true);
  });

  it('5. Si el producto cae en varias promociones, muestra la de mayor beneficio', () => {
    const oferta2x1: OfertaItem = {
      id: 'of1',
      tipo: 'LLEVA_PAGA',
      nombre: '2x1 Café',
      descripcion: null,
      lleva: 2,
      paga: 1, // 50% de beneficio
      alcanceProductoId: '10',
      alcanceCategoriaId: null,
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
      creadoEn: '',
      vigenteAhora: true,
    };

    const ofertaDesc15: OfertaItem = {
      id: 'of2',
      tipo: 'DESCUENTO',
      nombre: '15% de descuento en Café',
      descripcion: null,
      lleva: null,
      paga: null,
      alcanceProductoId: '10',
      alcanceCategoriaId: null,
      descuentoTipo: 'PORCENTAJE',
      descuentoValor: 15, // 15% de beneficio
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
      orden: 2,
      activo: true,
      creadoEn: '',
      vigenteAhora: true,
    };

    // 2x1 (50%) gana a 15%
    const mapa = calcularMapaBeneficios([ofertaDesc15, oferta2x1], categoriasPrueba);
    expect(mapa.get('10')).toBe('2x1 hoy');
  });
});
