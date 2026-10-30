import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VistaPreviaProducto, BotonVistaPrevia } from '../VistaPreviaProducto';

const borrador = {
  nombre: 'Latte',
  precio: 8,
  descripcion: 'Café con leche',
  tamanos: [{ id: 't1', nombre: 'Chico', precio: 8 }, { id: 't2', nombre: 'Grande', precio: 12 }],
  grupos: [{ id: 'g1', nombre: 'Leche', obligatorio: true, maximo: 1, opciones: [{ id: 'o1', nombre: 'Entera', precioExtra: 0 }, { id: 'o2', nombre: 'Avena', precioExtra: 2 }] }],
};

describe('VistaPreviaProducto', () => {
  it('muestra tamaños, grupos y no agrega al pedido', () => {
    render(<VistaPreviaProducto borrador={borrador} onCerrar={() => {}} sinGuardar />);
    expect(screen.getByRole('dialog', { name: 'Así se ve en la carta' })).toBeTruthy();
    expect(screen.getAllByText(/Chico/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Grande/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Avena/).length).toBeGreaterThan(0);
    expect(screen.getByText('Vista previa de tus cambios sin guardar')).toBeTruthy();
    expect(screen.getByText('Vista previa: no se agrega al pedido')).toBeTruthy();
    expect(screen.queryByText('Agregar al pedido')).toBeNull();
  });

  it('conmuta celular/computadora y cierra con Escape', () => {
    let cerrado = false;
    render(<VistaPreviaProducto borrador={borrador} onCerrar={() => { cerrado = true; }} />);
    const esc = screen.getByTestId('vpp-escenario');
    expect(esc.className).toContain('vpp-escenario--celular');
    fireEvent.click(screen.getByRole('button', { name: 'Computadora' }));
    expect(esc.className).not.toContain('vpp-escenario--celular');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrado).toBe(true);
  });

  it('avisa si está oculto', () => {
    render(<VistaPreviaProducto borrador={{ nombre: 'X', oculto: true }} onCerrar={() => {}} />);
    expect(screen.getByText('Este producto no aparece en la carta.')).toBeTruthy();
  });

  it('el botón abre la ventana con el borrador actual', () => {
    render(<BotonVistaPrevia borrador={() => borrador} sinGuardar />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver cómo se ve en la carta' }));
    expect(screen.getByRole('dialog', { name: 'Así se ve en la carta' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar vista previa' }));
    expect(screen.queryByRole('dialog', { name: 'Así se ve en la carta' })).toBeNull();
  });
});
