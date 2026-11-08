import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '19', nombre: 'COMBO DUO', descripcion: null, fotoUrl: null, precio: 33,
  tamanos: [{ id: 't1', nombre: 'Regular 12 oz', precio: 33 }, { id: 't2', nombre: 'Grande 16 oz', precio: 38 }],
  grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
} as unknown as ProductoCarta;

const parte = (id: string, cantidad: number, extra: object = {}) => ({
  id, tipo: 'A_ELECCION', cantidad, categorias: [], productos: [], alternativas: [], disponible: true, ...extra,
});
const op = (id: string, nombre: string, extra: object = {}) => ({ id, nombre, disponible: true, ...extra });
const sab = (id: string, nombre: string, ok = true) => ({ id, nombre, disponible: ok, saldo: ok ? 9 : 0 });

const duo = (): OfertaItem =>
  ({
    id: '4', tipo: 'COMBO', nombre: 'Dúo', descripcion: null, lleva: null, paga: null, alcanceCategoriaId: null, alcanceProductoId: '19',
    descuentoTipo: null, descuentoValor: null, compraMinima: null, dias: [], horaDesde: null, horaHasta: null, fechaDesde: null, fechaHasta: null,
    canales: ['CARTA'], limiteUsos: null, usosActuales: 0, noSumaBeneficios: false, orden: 1, activo: true, creadoEn: '', disponible: true,
    combosParte: [
      parte('1', 2, {
        bebidas: true,
        opcionesDetalle: [
          op('101', 'FRAPPE OREO', { categoria: 'FRAPPES' }),
          op('102', 'ICED CAFÉ', { categoria: 'ICED' }),
          op('103', 'CAPUCCINO', { categoria: 'CALIENTES' }),
          op('104', 'CAFE AGOTADO', { categoria: 'CALIENTES', disponible: false }),
        ],
      }),
      parte('2', 2, {
        opcionesDetalle: [
          op('17', 'DONAS ARTESANALES', { sabores: [sab('s1', 'Fresa'), sab('s2', 'Manjar')] }),
          op('37', 'GALLETA CHOCOCHIPS', { sabores: [sab('g1', 'Choco chips'), sab('g2', 'Red velvet', false)] }),
        ],
      }),
    ],
  }) as unknown as OfertaItem;

const abrir = () => render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
const tarjeta = (n: number) => within(screen.getByRole('group', { name: `Bebida ${n}` }));
const cabecera = (n: number) => tarjeta(n).getAllByRole('button')[0];

describe('Armado interactivo del combo', () => {
  beforeEach(() => agregarLinea.mockClear());

  it('la tarjeta abierta cierra sola al elegir, muestra la elegida y abre la siguiente pendiente', () => {
    abrir();
    expect(cabecera(1)).toHaveAttribute('aria-expanded', 'true');
    expect(cabecera(2)).toHaveAttribute('aria-expanded', 'false');
    expect(cabecera(2)).toHaveTextContent('Elige tu bebida 2');
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    expect(cabecera(1)).toHaveAttribute('aria-expanded', 'false');
    expect(cabecera(1)).toHaveTextContent('FRAPPE OREO');
    expect(cabecera(1)).toHaveTextContent('Cambiar');
    expect(cabecera(2)).toHaveAttribute('aria-expanded', 'true');
  });

  it('los chips de categoría filtran y el buscador filtra sin acentos', () => {
    abrir();
    fireEvent.click(tarjeta(1).getByRole('button', { name: 'ICED' }));
    expect(tarjeta(1).queryByRole('button', { name: /CAPUCCINO/ })).toBeNull();
    expect(tarjeta(1).getByRole('button', { name: /ICED CAFÉ/ })).toBeInTheDocument();
    fireEvent.click(tarjeta(1).getByRole('button', { name: 'Todas' }));
    expect(tarjeta(1).getByRole('button', { name: /CAPUCCINO/ })).toBeInTheDocument();
  });

  it('el buscador (con más de 8 bebidas) ignora los acentos', () => {
    const o = duo();
    const p = o.combosParte![0] as unknown as { opcionesDetalle: unknown[] };
    for (let i = 0; i < 8; i++) p.opcionesDetalle.push(op(`x${i}`, `RELLENO ${i}`));
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={o} />);
    fireEvent.change(screen.getByLabelText('Buscar bebida'), { target: { value: 'cafe' } });
    expect(tarjeta(1).getByRole('button', { name: /ICED CAFÉ/ })).toBeInTheDocument();
    expect(tarjeta(1).queryByRole('button', { name: /CAPUCCINO/ })).toBeNull();
  });

  it('«Misma que la bebida 1» copia la elección y la bebida agotada se ve deshabilitada con «Agotado»', () => {
    abrir();
    expect(tarjeta(1).getByRole('button', { name: /CAFE AGOTADO/ })).toBeDisabled();
    expect(tarjeta(1).getByText('Agotado')).toBeInTheDocument();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /CAPUCCINO/ }));
    fireEvent.click(tarjeta(2).getByRole('button', { name: /Misma que la bebida 1/ }));
    expect(cabecera(2)).toHaveTextContent('CAPUCCINO');
    expect(cabecera(2)).toHaveAttribute('aria-expanded', 'false');
  });

  it('el complemento muestra contador, progreso, topes y «Completo ✓»; los agotados dicen «No hay stock»', () => {
    abrir();
    const bloque = within(screen.getByTestId('eleccion-combo-2'));
    expect(bloque.getByText('0 de 2 elegidas')).toBeInTheDocument();
    expect(bloque.getByText('Faltan 2')).toBeInTheDocument();
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Fresa' }));
    expect(bloque.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Manjar' }));
    expect(bloque.getByText('Completo ✓')).toBeInTheDocument();
    expect(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Fresa' })).toBeDisabled();
    // plegada: resumen en una línea
    fireEvent.click(bloque.getByRole('button', { name: /^DONAS ARTESANALES/ }));
    expect(bloque.getByText('1 Fresa · 1 Manjar')).toBeInTheDocument();
    fireEvent.click(bloque.getByRole('button', { name: /^GALLETA CHOCOCHIPS/ }));
    expect(bloque.getByRole('button', { name: 'Agregar GALLETA CHOCOCHIPS · Red velvet' })).toBeDisabled();
    expect(bloque.getByText('No hay stock')).toBeInTheDocument();
  });

  it('la barra de progreso lista los pasos con su estado y «Faltan N» se actualiza', () => {
    abrir();
    const barra = within(screen.getByTestId('progreso-combo'));
    expect(barra.getByText('Faltan 3')).toBeInTheDocument();
    expect(barra.getByRole('button', { name: 'Paso 1: Tamaño, listo' })).toBeInTheDocument();
    expect(barra.getByRole('button', { name: 'Paso 2: Bebida 1, pendiente' })).toBeInTheDocument();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    expect(barra.getByText('Faltan 2')).toBeInTheDocument();
    expect(barra.getByRole('button', { name: 'Paso 2: Bebida 1, listo' })).toBeInTheDocument();
  });

  it('el botón deshabilitado dice el motivo y el toque lleva al primer faltante abriéndolo', () => {
    vi.useFakeTimers();
    abrir();
    expect(screen.getByRole('button', { name: /Falta elegir: Bebida 1/ })).toBeDisabled();
    fireEvent.click(cabecera(1)); // la plegamos
    expect(cabecera(1)).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: /Ver qué falta/ }));
    act(() => {
      vi.runAllTimers();
    });
    expect(cabecera(1)).toHaveAttribute('aria-expanded', 'true');
    vi.useRealTimers();
  });

  it('los nombres y la nota son plegables (cerrados al inicio) con contador de letras', () => {
    abrir();
    const cab = screen.getByRole('button', { name: /Nombres para el vaso \(opcional\)/ });
    expect(cab).toHaveAttribute('aria-expanded', 'false');
    expect(cab).toHaveAttribute('aria-controls', 'cuerpo-nombres-envase');
    fireEvent.click(cab);
    expect(cab).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(document.getElementById('nombre-bebida-0') as HTMLInputElement, { target: { value: 'Lucía' } });
    expect(screen.getByText('5/14')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nota para cocina/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('el pie resume el combo y el payload es el de siempre (bebidas, sabores, nombres, nota, cantidad)', () => {
    abrir();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(tarjeta(2).getByRole('button', { name: /CAPUCCINO/ }));
    const bloque = within(screen.getByTestId('eleccion-combo-2'));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Fresa' }));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Manjar' }));
    expect(screen.getByTestId('resumen-combo')).toHaveTextContent('Tu combo: Regular 12 oz · FRAPPE OREO + CAPUCCINO · 1 Fresa + 1 Manjar');
    fireEvent.click(screen.getByRole('button', { name: /Nombres para el vaso/ }));
    fireEvent.change(document.getElementById('nombre-bebida-0') as HTMLInputElement, { target: { value: 'Lucía' } });
    fireEvent.click(screen.getByRole('button', { name: /Nota para cocina/ }));
    fireEvent.change(screen.getByLabelText(/Nota para cocina/, { selector: 'input' }), { target: { value: 'sin hielo' } });
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    const l = agregarLinea.mock.calls[0][0];
    expect(l.cantidad).toBe(1);
    expect(l.personas).toEqual(['Lucía', '']);
    expect(l.nota).toBe('sin hielo');
    expect(l.ofertaId).toBe('4');
    expect(l.comboElecciones).toEqual([
      { parteId: '1', productoId: '101' },
      { parteId: '1', productoId: '103' },
      { parteId: '2', productoId: '17', saborId: 's1' },
      { parteId: '2', productoId: '17', saborId: 's2' },
    ]);
  });
});
