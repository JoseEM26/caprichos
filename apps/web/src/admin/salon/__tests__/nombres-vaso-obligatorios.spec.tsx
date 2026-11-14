import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';

const frappe: any = { id: 'f1', nombre: 'FRAPPE OREO', descripcion: null, fotoUrl: null, precio: 14, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null };

describe('Caja y mozo: el nombre de cada vaso es obligatorio', () => {
  it('sin nombre no agrega y dice cuál falta; el atajo usa el nombre del cliente', () => {
    const alAgregar = vi.fn();
    render(<VentanaOpcionesProducto producto={frappe} categoriaNombre="FRAPPES" nombreCliente="Rosa" alCerrar={vi.fn()} alAgregar={alAgregar} />);
    expect(document.getElementById('nombre-bebida-0')).toBeRequired();
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(alAgregar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del vaso de la bebida');
    fireEvent.click(screen.getByRole('button', { name: 'Usar el nombre del cliente' }));
    fireEvent.click(screen.getByText('Agregar al pedido'));
    expect(alAgregar.mock.calls[0][0].unidades[0].nombreVaso).toBe('Rosa');
  });

  it('sin nombre de cliente conocido no hay atajo', () => {
    render(<VentanaOpcionesProducto producto={frappe} categoriaNombre="FRAPPES" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Usar el nombre del cliente' })).toBeNull();
  });
});
