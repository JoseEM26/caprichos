import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { ProductoCarta } from '../../../carta/tipos';
import { OfertaItem } from '../../ofertas/ofertasApi';
import { nombrarVasos } from '../../../carta/__tests__/nombrarVasos';

const producto: ProductoCarta = {
  id: '19', nombre: 'COMBO DUO', descripcion: null, fotoUrl: null, precio: 30, tamanos: [{ id: 't1', nombre: 'Regular 12 oz', precio: 30 }], sabores: [],
  noSumaBeneficios: false, disponible: true, agotadoHasta: null, grupos: [],
} as unknown as ProductoCarta;

const op = (id: string, nombre: string) => ({ id, nombre, disponible: true });

/** Mismo Dúo con 4 bebidas que en la carta: en el mozo también es un paso «Bebidas» con sub-progreso. */
const oferta = {
  id: '4', tipo: 'COMBO', nombre: 'Dúo Irresistible', alcanceProductoId: '19', activo: true, disponible: true,
  combosParte: [
    {
      id: '1', tipo: 'A_ELECCION', cantidad: 4, categorias: [], productos: [], alternativas: [], disponible: true, bebidas: true,
      opcionesDetalle: [op('101', 'FRAPPE OREO'), op('102', 'ICED CAFÉ'), op('103', 'CAPUCCINO')],
    },
  ],
} as unknown as OfertaItem;

describe('Mozo: Dúo con 4 bebidas en el asistente', () => {
  it('un paso «Bebidas» con sub-progreso, Detalles con los vasos en filas y el resumen en texto con Cambiar', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={producto} oferta={oferta} alCerrar={() => {}} alAgregar={alAgregar} />);
    // tamaño + bebidas + detalles: tres decisiones → asistente; el tamaño ya viene elegido
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 1 de 4');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 1 de 4');
    expect(screen.getAllByRole('group', { name: /^Bebida \d$/ })).toHaveLength(1);
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 1' })).getByRole('button', { name: /^FRAPPE OREO$/ }));
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 2 de 4');
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 2' })).getByRole('button', { name: /^ICED CAFÉ$/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 3' })).getByRole('button', { name: /^CAPUCCINO$/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Bebida 4' })).getByRole('button', { name: /^FRAPPE OREO$/ }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 3 de 4');
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Detalles');
    expect(document.querySelectorAll('.cv-fila')).toHaveLength(4);
    nombrarVasos('Mesa');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByTestId('texto-resumen')).toHaveTextContent('Vasos a nombre de: Mesa1, Mesa2, Mesa3, Mesa4');
    expect(screen.getByRole('button', { name: 'Cambiar bebidas' })).toBeInTheDocument();
    // una sola barra de pie: el pie del asistente (el de «Agregar» de la vista vieja no sale)
    expect(screen.getAllByRole('button', { name: /Agregar al pedido/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(alAgregar.mock.calls[0][0].nombresBebidas).toEqual(['Mesa1', 'Mesa2', 'Mesa3', 'Mesa4']);
  });
});
