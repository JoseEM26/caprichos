import { describe, it, expect, vi, beforeEach } from 'vitest';
sessionStorage.setItem('caprichos.nombreInvitado', 'Invitado');
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';
import { nombrarVasos } from './nombrarVasos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '19', nombre: 'COMBO DUO', descripcion: null, fotoUrl: null, precio: 33,
  tamanos: [{ id: 't1', nombre: 'Regular 12 oz', precio: 33 }, { id: 't2', nombre: 'Grande 16 oz', precio: 38 }],
  grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
} as unknown as ProductoCarta;

const op = (id: string, nombre: string) => ({ id, nombre, disponible: true });

/** Dúo con 4 bebidas (un solo paso «Bebidas» con sub-progreso) y sin complemento. */
const duoCuatro = (): OfertaItem =>
  ({
    id: '4', tipo: 'COMBO', nombre: 'Dúo Irresistible', descripcion: null, lleva: null, paga: null, alcanceCategoriaId: null, alcanceProductoId: '19',
    descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null,
    canales: ['CARTA'], limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible: true,
    combosParte: [
      {
        id: '1', tipo: 'A_ELECCION', cantidad: 4, categorias: [], productos: [], alternativas: [], disponible: true, bebidas: true,
        opcionesDetalle: [op('101', 'FRAPPE OREO'), op('102', 'ICED CAFÉ'), op('103', 'CAPUCCINO')],
      },
    ],
  }) as unknown as OfertaItem;

const abrir = () => render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duoCuatro()} />);
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

describe('Dúo con 4 bebidas: un paso «Bebidas» con sub-progreso', () => {
  beforeEach(() => agregarLinea.mockClear());

  it('la barra tiene Tamaño › Bebidas › Detalles › Resumen; las bebidas avanzan una a una dentro del paso', () => {
    abrir();
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 1 de 4');
    siguiente();
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 1 de 4');
    // una sola bebida visible por sub-paso (no las cuatro a la vez)
    expect(screen.getAllByRole('group', { name: /^Bebida \d$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ })); // avanza sola a la 2
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 2 de 4');
    fireEvent.click(screen.getByRole('button', { name: /^ICED CAFÉ$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^CAPUCCINO$/ }));
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 4 de 4');
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ })); // la última pasa al paso «Detalles»
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 3 de 4');
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Detalles');
  });

  it('en Detalles, los vasos van en filas (etiqueta «Bebida N», bebida y contador); el resumen en texto ofrece Cambiar bebidas', () => {
    abrir();
    siguiente();
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^ICED CAFÉ$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^CAPUCCINO$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ }));
    const filas = document.querySelectorAll('.cv-fila');
    expect(filas).toHaveLength(4);
    expect(within(filas[0] as HTMLElement).getByText('Bebida 1')).toBeInTheDocument();
    expect(within(filas[3] as HTMLElement).getByText('Bebida 4')).toBeInTheDocument();
    expect(within(filas[0] as HTMLElement).getByText('0/14')).toBeInTheDocument();
    nombrarVasos('Ana');
    expect(screen.getByRole('button', { name: /Nota para cocina/ })).toBeInTheDocument(); // plegada dentro de Detalles
    siguiente();
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 4 de 4');
    const texto = screen.getByTestId('texto-resumen');
    expect(texto).toHaveTextContent('incluye 4 bebidas: FRAPPE OREO, ICED CAFÉ, CAPUCCINO, FRAPPE OREO');
    expect(texto).toHaveTextContent('Vasos a nombre de: Ana1, Ana2, Ana3, Ana4');
    expect(screen.getByRole('button', { name: 'Cambiar bebidas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar detalles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agregar al pedido · S\/ 33.00/ })).toBeEnabled();
    // el resumen en texto aparece una sola vez: la línea del pie no lo repite
    expect(screen.queryByTestId('resumen-asistente')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    expect(agregarLinea).toHaveBeenCalledTimes(1);
    expect(agregarLinea.mock.calls[0][0].personas).toEqual(['Ana1', 'Ana2', 'Ana3', 'Ana4']);
  });

  it('«Cambiar bebidas» vuelve a la etapa de bebidas sin perder lo elegido', () => {
    abrir();
    siguiente();
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^ICED CAFÉ$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^CAPUCCINO$/ }));
    fireEvent.click(screen.getByRole('button', { name: /^FRAPPE OREO$/ }));
    nombrarVasos();
    siguiente();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar bebidas' }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 2 de 4');
    expect(screen.getByTestId('sub-progreso')).toHaveTextContent('Bebida 1 de 4');
    expect(screen.getByRole('button', { name: 'Bebida 1, lista' })).toBeInTheDocument();
  });
});
