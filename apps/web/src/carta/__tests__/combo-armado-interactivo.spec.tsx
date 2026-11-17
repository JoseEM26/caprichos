import { describe, it, expect, vi, beforeEach } from 'vitest';
sessionStorage.setItem('caprichos.nombreInvitado', 'Invitado'); // el invitado ya dijo su nombre (si no, la carta lo pide primero)
import { render, screen, fireEvent, within } from '@testing-library/react';
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
// Asistente por pasos: «Siguiente» avanza un paso; el chip «Paso N» vuelve a un paso ya hecho
const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
const irPaso = (n: number) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Paso ${n}:`) }));

describe('Armado interactivo del combo (asistente por pasos)', () => {
  beforeEach(() => agregarLinea.mockClear());

  it('un paso a la vez: el tamaño sigue con «Siguiente»; cada bebida es su paso y la elegida avanza sola', () => {
    abrir();
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 1 de 7');
    expect(screen.queryByRole('group', { name: 'Bebida 1' })).toBeNull();
    siguiente();
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Bebida 1');
    expect(cabecera(1)).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    // la bebida 1 ya está lista: avanza sola a la bebida 2, sin saltarse nada
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Bebida 2');
    expect(screen.queryByRole('group', { name: 'Bebida 1' })).toBeNull();
    irPaso(2);
    expect(cabecera(1)).toHaveTextContent('FRAPPE OREO');
    expect(cabecera(1)).toHaveTextContent('Cambiar');
  });

  it('los chips de categoría filtran y el buscador filtra sin acentos', () => {
    abrir();
    siguiente();
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
    siguiente();
    fireEvent.change(screen.getByLabelText('Buscar bebida'), { target: { value: 'cafe' } });
    expect(tarjeta(1).getByRole('button', { name: /ICED CAFÉ/ })).toBeInTheDocument();
    expect(tarjeta(1).queryByRole('button', { name: /CAPUCCINO/ })).toBeNull();
  });

  it('«Igual que la bebida 1» copia la elección y la bebida agotada se ve deshabilitada con «Agotado»', () => {
    abrir();
    siguiente();
    expect(tarjeta(1).getByRole('button', { name: /CAFE AGOTADO/ })).toBeDisabled();
    expect(tarjeta(1).getByText('Agotado')).toBeInTheDocument();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /CAPUCCINO/ }));
    // ya está en la bebida 2: el atajo copia la bebida 1
    fireEvent.click(tarjeta(2).getByRole('button', { name: /Igual que la bebida 1/ }));
    irPaso(3);
    expect(cabecera(2)).toHaveTextContent('CAPUCCINO');
  });

  it('el complemento muestra contador, progreso, topes y «Completo ✓»; los agotados dicen «No hay stock»', () => {
    abrir();
    siguiente();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(tarjeta(2).getByRole('button', { name: /CAPUCCINO/ }));
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Complemento');
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

  it('la barra de pasos lista cada paso con su estado y el número de paso se actualiza', () => {
    abrir();
    const barra = within(screen.getByTestId('progreso-asistente'));
    expect(barra.getByRole('button', { name: 'Paso 1: Tamaño, listo' })).toBeInTheDocument();
    expect(barra.getByRole('button', { name: 'Paso 2: Bebida 1, pendiente' })).toBeInTheDocument();
    siguiente();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    expect(screen.getByTestId('paso-texto')).toHaveTextContent('Paso 3 de 7');
    expect(barra.getByRole('button', { name: 'Paso 2: Bebida 1, listo' })).toBeInTheDocument();
    expect(barra.getByRole('button', { name: 'Paso 3: Bebida 2, pendiente' })).toHaveAttribute('aria-current', 'step');
  });

  it('«Siguiente» bloqueado dice qué falta; Atrás no pierde lo elegido', () => {
    abrir();
    siguiente();
    const sig = screen.getByRole('button', { name: 'Siguiente' });
    expect(sig).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Elige tu bebida 1');
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Bebida 1');
    expect(cabecera(1)).toHaveTextContent('FRAPPE OREO');
  });

  it('los nombres son obligatorios en su paso y la nota es un paso opcional', () => {
    abrir();
    siguiente();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(tarjeta(2).getByRole('button', { name: /CAPUCCINO/ }));
    const bloque = within(screen.getByTestId('eleccion-combo-2'));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Fresa' }));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Manjar' }));
    siguiente();
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Nombres para el vaso');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByTestId('motivo-siguiente')).toHaveTextContent('Escribe el nombre del vaso de la Bebida 1');
    fireEvent.change(document.getElementById('nombre-bebida-0') as HTMLInputElement, { target: { value: 'Lucía' } });
    expect(screen.getByText('5/14')).toBeInTheDocument();
    fireEvent.change(document.getElementById('nombre-bebida-1') as HTMLInputElement, { target: { value: 'Pedro' } });
    siguiente();
    expect(screen.getByTestId('titulo-paso')).toHaveTextContent('Nota para cocina');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('el resumen muestra lo elegido y el payload es el de siempre (bebidas, sabores, nombres, nota, cantidad)', () => {
    abrir();
    siguiente();
    fireEvent.click(tarjeta(1).getByRole('button', { name: /FRAPPE OREO/ }));
    fireEvent.click(tarjeta(2).getByRole('button', { name: /CAPUCCINO/ }));
    const bloque = within(screen.getByTestId('eleccion-combo-2'));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Fresa' }));
    fireEvent.click(bloque.getByRole('button', { name: 'Agregar DONAS ARTESANALES · Manjar' }));
    siguiente();
    fireEvent.change(document.getElementById('nombre-bebida-0') as HTMLInputElement, { target: { value: 'Lucía' } });
    fireEvent.change(document.getElementById('nombre-bebida-1') as HTMLInputElement, { target: { value: 'Pedro' } });
    siguiente();
    fireEvent.click(screen.getByRole('button', { name: /Nota para cocina/ }));
    fireEvent.change(screen.getByLabelText(/Nota para cocina/, { selector: 'input' }), { target: { value: 'sin hielo' } });
    siguiente();
    expect(screen.getByTestId('resumen-pasos')).toBeInTheDocument();
    expect(screen.getByTestId('resumen-asistente')).toHaveTextContent('Regular 12 oz · FRAPPE OREO + CAPUCCINO · 1 Fresa + 1 Manjar');
    fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/ }));
    const l = agregarLinea.mock.calls[0][0];
    expect(l.cantidad).toBe(1);
    expect(l.personas).toEqual(['Lucía', 'Pedro']);
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
