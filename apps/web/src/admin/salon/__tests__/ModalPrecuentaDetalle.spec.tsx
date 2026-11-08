import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ModalPrecuenta } from '../componentes/ModalPrecuenta';

describe('ModalPrecuenta - detalle de cada línea', () => {
  const props = {
    abierto: true,
    alCerrar: vi.fn(),
    mesa: 'Mesa 4',
    total: 59,
    subtotal: 70,
    notaPedido: 'Sin cubiertos',
    descuentos: [
      { tipo: 'PROMO', nombre: 'Promo Dúo', monto: 5 },
      { tipo: 'PERSONAL', nombre: 'Descuento del personal 25%', monto: 6 },
    ],
    lineas: [
      {
        cantidad: 2,
        nombre: 'Dona',
        detalle: '',
        precio: 40,
        entrada: {
          cantidad: 2,
          nombre: 'Dona',
          tamano: 'Caja x6',
          precioUnit: 20,
          subtotal: 40,
          sabores: [
            { sabor: 'Fresa', cantidad: 3 },
            { sabor: 'Oreo', cantidad: 3 },
          ],
          nota: 'sin hielo',
          nombresPersona: ['Luis'],
        },
      },
      {
        cantidad: 1,
        nombre: 'Combo',
        detalle: '',
        precio: 30,
        entrada: { cantidad: 1, nombre: 'Combo', subtotal: 30, partes: [{ cantidad: 1, nombre: 'Frappe', tamano: 'Mediano', subtotal: 0, sabor: 'Moka' }] },
      },
      { cantidad: 1, nombre: 'Galleta', detalle: '', precio: 0, entrada: { cantidad: 1, nombre: 'Galleta', subtotal: 0, cortesia: { valorLista: 6 } } },
    ],
  };

  it('muestra sabores, nota, para quién, piezas del combo y cortesía en gris', () => {
    render(<ModalPrecuenta {...props} />);
    const lista = screen.getByRole('list', { name: 'Productos' });
    expect(within(lista).getByText('Dona (Caja x6)')).toBeInTheDocument();
    expect(within(lista).getByText('Sabores: 3 Fresa · 3 Oreo')).toHaveClass('pc-detalle');
    expect(within(lista).getByText('Nota: sin hielo')).toHaveClass('pc-detalle');
    expect(within(lista).getByText('Para: Luis')).toBeInTheDocument();
    expect(within(lista).getByText('1 x Frappe (Mediano)')).toBeInTheDocument();
    expect(within(lista).getByText('Sabor: Moka')).toBeInTheDocument();
    expect(within(lista).getByText('CORTESÍA S/ 0.00 (valor S/ 6.00)')).toBeInTheDocument();
  });

  it('desglosa los descuentos por nombre y muestra la nota del pedido', () => {
    render(<ModalPrecuenta {...props} />);
    expect(screen.getByText('Promo Dúo').parentElement).toHaveTextContent('- S/ 5.00');
    expect(screen.getByText('Descuento del personal 25%').parentElement).toHaveTextContent('- S/ 6.00');
    expect(screen.getByText('Nota del pedido: Sin cubiertos')).toBeInTheDocument();
  });

  it('sin entrada ni descuentos desglosados sigue igual que antes', () => {
    render(<ModalPrecuenta abierto alCerrar={vi.fn()} mesa="Mesa 1" total={17} subtotal={19} descuento={2} lineas={[{ cantidad: 1, nombre: 'Frappe', detalle: 'Grande', precio: 19 }]} />);
    expect(screen.getByText('Grande')).toHaveClass('pc-detalle');
    expect(screen.getByText('Descuento')).toBeInTheDocument();
  });
});
