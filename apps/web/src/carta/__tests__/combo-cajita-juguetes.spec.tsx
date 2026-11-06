import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
const botonAgregar = () => screen.getByRole('button', { name: /Agregar al pedido|Elige las opciones obligatorias/ });
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '9', nombre: 'COMBO CAJITA CAPRIKIDS', descripcion: null, fotoUrl: null, precio: 27,
  tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

/** Cajita: FRAPPE OREO fijo + 2 juguetes a elegir (uno agotado). */
const cajita = (): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'COMBO CAJITA CAPRIKIDS', descripcion: null, lleva: null, paga: null,
    alcanceCategoriaId: null, alcanceProductoId: '9', descuentoTipo: null, descuentoValor: null, compraMinima: null,
    dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'],
    limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible: true,
    combosParte: [
      { id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], principalNombre: 'FRAPPE OREO', reemplazos: [], disponible: true, opcionesDisponibles: ['5'] },
      {
        id: '200', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['30', '31', '32'],
        opcionesDetalle: [
          { id: '30', nombre: 'Pistola de burbujas', disponible: true },
          { id: '31', nombre: 'Burbujas', disponible: true },
          { id: '32', nombre: 'Squishy', disponible: false },
        ],
      },
    ],
  }) as OfertaItem;

describe('Combo cajita: elegir 2 juguetes', () => {
  it('sin juguetes no se puede agregar; con 2 elegidos sí, y viajan como elecciones', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={cajita()} />);
    expect(botonAgregar()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar Pistola de burbujas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Burbujas' }));
    expect(botonAgregar()).toBeEnabled();

    fireEvent.click(botonAgregar());
    expect(agregarLinea.mock.calls[0][0].ofertaId).toBe('1');
    expect(agregarLinea.mock.calls[0][0].comboElecciones).toEqual([
      { parteId: '100', productoId: '5' },
      { parteId: '200', productoId: '30' },
      { parteId: '200', productoId: '31' },
    ]);
  });

  it('un juguete agotado se ve como no disponible y no se puede elegir', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={cajita()} />);
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar Squishy' })).toBeDisabled();
  });

  it('con dos cajitas hacen falta 4 juguetes', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={cajita()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Pistola de burbujas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Agregar Burbujas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    expect(botonAgregar()).toBeDisabled();
  });
});
