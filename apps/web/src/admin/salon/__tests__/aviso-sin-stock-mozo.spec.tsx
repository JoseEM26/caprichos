import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VentanaOpcionesProducto } from '../componentes/VentanaOpcionesProducto';
import { TarjetaProducto } from '../componentes/SelectorCartaTactil';

const dona: any = { id: 'd1', nombre: 'DONA GLASEADA', descripcion: null, fotoUrl: null, precio: 5, tamanos: [], grupos: [], sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null, controlaStock: true, quedan: 0 };

describe('Nuevo pedido: aviso cuando no hay stock de la producción del día', () => {
  it('la ventana dice que no hay stock y el botón lo explica', () => {
    render(<VentanaOpcionesProducto producto={dona} categoriaNombre="DONAS" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.getByTestId('aviso-stock').textContent).toContain('No hay stock de DONA GLASEADA');
    expect(screen.getByText('Sin stock')).toBeTruthy();
  });
  it('con stock limitado, al llegar al tope avisa cuántas quedan', () => {
    render(<VentanaOpcionesProducto producto={{ ...dona, quedan: 1 }} categoriaNombre="DONAS" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.getByTestId('aviso-stock').textContent).toContain('Solo quedan 1');
  });
  it('con stock libre no muestra aviso', () => {
    render(<VentanaOpcionesProducto producto={{ ...dona, quedan: 10 }} categoriaNombre="DONAS" alCerrar={vi.fn()} alAgregar={vi.fn()} />);
    expect(screen.queryByTestId('aviso-stock')).toBeNull();
  });
  it('la tarjeta del producto marca «Sin stock hoy»', () => {
    render(<TarjetaProducto producto={dona} conImagenes={false} alElegir={vi.fn()} />);
    expect(screen.getByTestId('tarjeta-sin-stock')).toBeTruthy();
  });
});
