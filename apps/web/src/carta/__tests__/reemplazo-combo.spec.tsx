import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TarjetaOferta } from '../TarjetaOferta';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '10', nombre: 'Combo Dúo Irresistible', descripcion: null, fotoUrl: null, precio: 30,
  tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

const combo = (disponible: boolean, opcionesDisponibles: string[]): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'Combo Dúo Irresistible', descripcion: null, lleva: null, paga: null,
    alcanceCategoriaId: null, alcanceProductoId: '10', descuentoTipo: null, descuentoValor: null, compraMinima: null,
    dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null, canales: ['CARTA'],
    limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible,
    combosPrecio: [{ tamanoNombre: 'Regular', precio: 30 }],
    combosParte: [
      {
        id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], principalNombre: 'Club Sandwich',
        reemplazos: ['7', '8'], reemplazosDetalle: [{ id: '7', nombre: 'Empanada' }, { id: '8', nombre: 'Croissant' }],
        disponible, opcionesDisponibles,
      },
    ],
  }) as OfertaItem;

describe('Combo con plan B en la carta', () => {
  it('principal disponible: no hay aviso y se puede agregar', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={combo(true, ['5'])} />);
    expect(screen.queryByTestId('aviso-reemplazo-combo')).toBeNull();
    agregarLinea.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    // el servidor valida también el principal (por si se agota justo antes de enviar)
    expect(agregarLinea.mock.calls[0][0].comboElecciones).toEqual([{ parteId: '100', productoId: '5' }]);
  });

  it('principal agotado: avisa y obliga a elegir uno de los reemplazos disponibles', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={combo(true, ['7', '8'])} />);
    expect(screen.getByText('Club Sandwich no está disponible ahora; elige uno de estos:')).toBeInTheDocument();
    const agregar = screen.getByRole('button', { name: /Elige las opciones obligatorias/i });
    expect(agregar).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Empanada' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    expect(agregarLinea.mock.calls[0][0].nota).toBe('Empanada (en lugar de Club Sandwich)');
    expect(agregarLinea.mock.calls[0][0].ofertaId).toBe('1');
    expect(agregarLinea.mock.calls[0][0].comboElecciones).toEqual([{ parteId: '100', productoId: '7' }]);
  });

  it('si solo queda un reemplazo viene preseleccionado', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={combo(true, ['8'])} />);
    expect(screen.getByRole('button', { name: 'Croissant' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Agregar al pedido/i })).toBeEnabled();
  });

  it('combo agotado: la tarjeta dice Agotado y no tiene botón de agregar', () => {
    render(<TarjetaOferta oferta={combo(false, [])} productos={[producto]} categorias={[]} />);
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Personalizar/i })).toBeNull();
  });

  it('combo agotado: la ventana no deja agregar', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={combo(false, [])} />);
    expect(screen.getByRole('button', { name: /^Agotado/ })).toBeDisabled();
  });
});

describe('Combo con bebidas pide nombre por envase', () => {
  it('un campo por bebida y los nombres viajan en personas, en orden', () => {
    agregarLinea.mockClear();
    const opc = (id: string, nombre: string) => ({ id, nombre, precioExtra: 0 });
    const duo = {
      ...producto,
      grupos: [
        { id: 'g1', nombre: 'Bebida 1 · Bebida', obligatorio: true, minimo: 1, maximo: 1, opciones: [opc('a', 'Frappe Moca')] },
        { id: 'g2', nombre: 'Bebida 2 · Bebida', obligatorio: true, minimo: 1, maximo: 1, opciones: [opc('b', 'Café Latte')] },
      ],
    } as unknown as ProductoCarta;
    render(<VentanaProductoCarta producto={duo} esBebida={false} onCerrar={() => {}} />);
    const campos = screen.getAllByLabelText(/Nombre para el envase \(opcional/i);
    expect(campos).toHaveLength(2);
    expect(screen.getByText(/Frappe Moca · Nombre para el envase/)).toBeInTheDocument();
    fireEvent.change(campos[0], { target: { value: 'Lucía' } });
    fireEvent.change(campos[1], { target: { value: 'Pedro' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));
    expect(agregarLinea.mock.calls[0][0].personas).toEqual(['Lucía', 'Pedro']);
  });
});
