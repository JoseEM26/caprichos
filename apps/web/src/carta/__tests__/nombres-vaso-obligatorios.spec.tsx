import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { ProductoCarta } from '../tipos';
import * as cuentaModulo from '../cuenta/CuentaContext';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const opc = (id: string, nombre: string) => ({ id, nombre, precioExtra: 0, disponible: true });
const base = { descripcion: null, fotoUrl: null, tamanos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null };
const frappe = { ...base, id: '1', nombre: 'FRAPPE OREO', precio: 14, grupos: [] } as unknown as ProductoCarta;
const duo = {
  ...base, id: '2', nombre: 'Dúo', precio: 30,
  grupos: [
    { id: 'g1', nombre: 'Bebida 1 · Bebida', obligatorio: true, minimo: 1, maximo: 1, opciones: [opc('a', 'Frappe Moca')] },
    { id: 'g2', nombre: 'Bebida 2 · Bebida', obligatorio: true, minimo: 1, maximo: 1, opciones: [opc('b', 'Café Latte')] },
  ],
} as unknown as ProductoCarta;

const agregar = () => screen.getByRole('button', { name: /Agregar al pedido/i });

describe('carta: el nombre de cada vaso es obligatorio', () => {
  beforeEach(() => {
    agregarLinea.mockClear();
    vi.spyOn(cuentaModulo, 'useCuentaOpcional').mockReturnValue({ cliente: { nombre: 'Rosa' } } as any);
  });

  it('bebida suelta: campo requerido, dice qué falta y el atajo usa el nombre del cliente', () => {
    render(<VentanaProductoCarta producto={frappe} esBebida onCerrar={() => {}} />);
    expect(document.getElementById('nombre-bebida-0')).toBeRequired();
    fireEvent.click(agregar());
    expect(agregarLinea).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del vaso de la bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Usar el nombre del cliente' }));
    expect((document.getElementById('nombre-bebida-0') as HTMLInputElement).value).toBe('Rosa');
    fireEvent.click(agregar());
    expect(agregarLinea.mock.calls[0][0].personas).toEqual(['Rosa']);
  });

  it('combo con 2 bebidas: ya no dice «opcional», pide el vaso que falta y el atajo rellena solo los vacíos', () => {
    render(<VentanaProductoCarta producto={duo} esBebida={false} onCerrar={() => {}} />);
    expect(screen.queryByText(/Nombres para el vaso \(opcional\)/)).toBeNull();
    const campos = screen.getAllByLabelText(/Nombre para el envase \(obligatorio/);
    expect(campos).toHaveLength(2);
    campos.forEach((c) => expect(c).toBeRequired());
    fireEvent.change(campos[0], { target: { value: 'Lucía' } });
    fireEvent.click(agregar());
    expect(agregarLinea).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del vaso de la Bebida 2');
    fireEvent.click(screen.getByRole('button', { name: 'Usar el nombre del cliente' }));
    expect((campos[0] as HTMLInputElement).value).toBe('Lucía');
    expect((campos[1] as HTMLInputElement).value).toBe('Rosa');
    fireEvent.click(agregar());
    expect(agregarLinea.mock.calls[0][0].personas).toEqual(['Lucía', 'Rosa']);
  });
});
