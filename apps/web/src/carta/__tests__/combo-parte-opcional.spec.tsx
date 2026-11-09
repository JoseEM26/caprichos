import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { eleccionesCombo, partesFijasResumen, recargoOpcionales } from '../ReemplazoCombo';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import { ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const producto: ProductoCarta = {
  id: '10', nombre: 'Dúo Irresistible', descripcion: null, fotoUrl: null, precio: 30,
  tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
};

/** Club sándwich siempre incluido + papas nativas OPCIONAL (incluida 1, hasta 3, extra S/ 6.00). */
const duo = (papas: Record<string, unknown> = {}): OfertaItem =>
  ({
    id: '1', tipo: 'COMBO', nombre: 'Dúo Irresistible', descripcion: null, alcanceProductoId: '10', canales: ['CARTA'],
    activo: true, disponible: true, combosPrecio: [{ tamanoNombre: 'Regular', precio: 30 }],
    combosParte: [
      { id: '100', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['5'], principalNombre: 'CLUB SANDWICH', disponible: true, opcionesDisponibles: ['5'] },
      {
        id: '101', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['6'], principalNombre: 'PAPAS NATIVAS', disponible: true, opcionesDisponibles: ['6'],
        opcional: true, cantidadMin: 0, cantidadMax: 3, incluidaPorDefecto: true, precioExtra: 6, ...papas,
      },
    ],
  }) as unknown as OfertaItem;

const agregar = () => fireEvent.click(screen.getByRole('button', { name: /Agregar al pedido/i }));

describe('Carta: parte opcional del combo (papas)', () => {
  it('aparece una tarjeta «PAPAS NATIVAS · ✓ Incluida» y «Incluye» solo lista lo obligatorio', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('PAPAS NATIVAS');
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('✓ Incluida');
    expect(screen.getByText('Incluye: CLUB SANDWICH')).toBeInTheDocument();
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('+ S/ 6.00 por cada extra');
  });

  it('por defecto lleva 1: sin cobro extra y viaja la cantidad 1', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    agregar();
    const l = agregarLinea.mock.calls[0][0];
    expect(l.precioUnitario).toBe(30);
    expect(l.comboElecciones).toEqual([{ parteId: '100', productoId: '5' }, { parteId: '101', productoId: '6', cantidad: 1 }]);
  });

  it('quitarla (0): dice «Sin papas nativas», el precio no baja y viaja cantidad 0', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno: PAPAS NATIVAS' }));
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('Sin papas nativas');
    expect(screen.getByRole('button', { name: 'Quitar uno: PAPAS NATIVAS' })).toBeDisabled();
    agregar();
    const l = agregarLinea.mock.calls[0][0];
    expect(l.precioUnitario).toBe(30);
    expect(l.comboElecciones).toContainEqual({ parteId: '101', productoId: '6', cantidad: 0 });
  });

  it('1 extra: recalcula el total (+ S/ 6.00) y respeta el máximo', () => {
    agregarLinea.mockClear();
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    const mas = () => screen.getByRole('button', { name: 'Agregar uno: PAPAS NATIVAS' });
    fireEvent.click(mas());
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('✓ Incluida + 1 extra');
    fireEvent.click(mas());
    fireEvent.click(mas());
    expect(mas()).toBeDisabled(); // máximo 3
    fireEvent.click(screen.getByRole('button', { name: 'Quitar uno: PAPAS NATIVAS' }));
    agregar();
    const l = agregarLinea.mock.calls[0][0];
    expect(l.precioUnitario).toBe(36); // quedó en 2 (3 menos uno): 30 + 1 extra × 6
    expect(l.comboElecciones).toContainEqual({ parteId: '101', productoId: '6', cantidad: 2 });
  });

  it('se entiende cuál es el extra: ayuda «Toca +», «Suma S/ 6.00 al combo» y el resumen del pie', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo()} />);
    // con lo incluido (1 papa) el cliente ve que ya está dentro del precio y cómo pedir más
    expect(screen.getByTestId('ayuda-extra-101')).toHaveTextContent(/Ya incluye 1\. Toca \+ si quieres más: cada una suma S\/ 6\.00/);
    expect(screen.queryByTestId('suma-extra-101')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar uno: PAPAS NATIVAS' }));
    expect(screen.queryByTestId('ayuda-extra-101')).toBeNull();
    expect(screen.getByTestId('suma-extra-101')).toHaveTextContent('Suma S/ 6.00 al combo');
    expect(screen.getByTestId('resumen-combo')).toHaveTextContent(/\+1 PAPAS NATIVAS extra \(S\/ 6\.00\)/);
  });

  it('no marcada por defecto: arranca en 0 y sin «Incluida»', () => {
    render(<VentanaProductoCarta producto={producto} esBebida={false} onCerrar={() => {}} oferta={duo({ incluidaPorDefecto: false })} />);
    expect(screen.getByTestId('parte-opcional-101')).toHaveTextContent('Sin papas nativas');
    expect(screen.getByTestId('parte-opcional-101')).not.toHaveTextContent('✓ Incluida');
  });

  it('helpers: una parte FIJO sin opcional sigue siendo fija y no manda cantidad', () => {
    const o = duo({ opcional: false });
    expect(partesFijasResumen(o)).toEqual(['CLUB SANDWICH', 'PAPAS NATIVAS']);
    expect(eleccionesCombo(o, {})).toEqual([{ parteId: '100', productoId: '5' }, { parteId: '101', productoId: '6' }]);
    expect(recargoOpcionales(o, { '101': 3 })).toBe(0);
  });
});
