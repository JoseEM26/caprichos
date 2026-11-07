import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VentanaProductoCarta } from '../VentanaProductoCarta';
import { agruparUnidadesIguales } from '../unidadesPorBebida';
import { GrupoOpcionesCarta, ProductoCarta } from '../tipos';

const agregarLinea = vi.fn();
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({ abrirModalProducto: vi.fn(), agregarLinea, cantidadTotal: 0, subtotal: 0, lineas: [], inventario: {} }),
}));

const endulzante: GrupoOpcionesCarta = {
  id: 'g-end', nombre: 'Endulzante', obligatorio: true, minimo: 1, maximo: 1,
  opciones: [
    { id: 'az', nombre: 'Azúcar', precioExtra: 0, disponible: true },
    { id: 'st', nombre: 'Stevia', precioExtra: 1, disponible: true },
    { id: 'sa', nombre: 'Sin azúcar', precioExtra: 0, disponible: true },
  ],
};
const topping: GrupoOpcionesCarta = {
  id: 'g-top', nombre: 'Topping', obligatorio: false, minimo: 0, maximo: 1,
  opciones: [{ id: 'cr', nombre: 'Crema', precioExtra: 2, disponible: true }],
};
const refresco = (grupos: GrupoOpcionesCarta[]): ProductoCarta => ({
  id: '7', nombre: 'Limonada frozen', descripcion: null, fotoUrl: null, precio: 10,
  tamanos: [], grupos, sabores: [], noSumaBeneficios: false, disponible: true, agotadoHasta: null,
});

const abrir = (p: ProductoCarta, esBebida = false) => render(<VentanaProductoCarta producto={p} esBebida={esBebida} onCerrar={() => {}} />);
const mas = (n: number) => { for (let i = 0; i < n; i++) fireEvent.click(screen.getByRole('button', { name: 'Más' })); };
const boton = () => screen.getByRole('button', { name: /Agregar|Elige las opciones/ });
const opcion = (bebida: number, nombre: string) => screen.getByRole('button', { name: new RegExp(`Bebida ${bebida}, .*: ${nombre}`) });

beforeEach(() => agregarLinea.mockClear());

describe('opciones por bebida en la carta', () => {
  it('cantidad 1 o producto sin grupos: no aparece el interruptor', () => {
    abrir(refresco([endulzante]));
    expect(screen.queryByRole('button', { name: 'Elegir por bebida' })).toBeNull();
    mas(1);
    expect(screen.getByRole('button', { name: 'Elegir por bebida' })).toBeInTheDocument();
  });

  it('producto sin grupos con cantidad 2: sin interruptor', () => {
    abrir(refresco([]));
    mas(1);
    expect(screen.queryByRole('button', { name: 'Elegir por bebida' })).toBeNull();
  });

  it('Todas iguales (por defecto): una sola línea con cantidad 2', () => {
    abrir(refresco([endulzante]));
    mas(1);
    fireEvent.click(boton());
    expect(agregarLinea).toHaveBeenCalledTimes(1);
    expect(agregarLinea.mock.calls[0][0]).toMatchObject({ cantidad: 2, subtotal: 20 });
  });

  it('Elegir por bebida: una sección por bebida y dos líneas distintas con su precio extra', () => {
    abrir(refresco([endulzante]));
    mas(1);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir por bebida' }));
    expect(screen.getByRole('group', { name: 'Bebida 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bebida 2' })).toBeInTheDocument();
    fireEvent.click(opcion(2, 'Stevia'));
    // 10 + (10 + 1)
    expect(boton()).toHaveTextContent('S/ 21.00');
    fireEvent.click(boton());
    expect(agregarLinea).toHaveBeenCalledTimes(2);
    expect(agregarLinea.mock.calls[0][0]).toMatchObject({ cantidad: 1, precioUnitario: 10, opciones: [expect.objectContaining({ id: 'az' })] });
    expect(agregarLinea.mock.calls[1][0]).toMatchObject({ cantidad: 1, precioUnitario: 11, subtotal: 11, opciones: [expect.objectContaining({ id: 'st' })] });
  });

  it('las bebidas con la misma configuración se agrupan en una línea', () => {
    abrir(refresco([endulzante]));
    mas(2); // 3 bebidas
    fireEvent.click(screen.getByRole('button', { name: 'Elegir por bebida' }));
    fireEvent.click(opcion(3, 'Sin azúcar'));
    fireEvent.click(boton());
    expect(agregarLinea).toHaveBeenCalledTimes(2);
    expect(agregarLinea.mock.calls[0][0]).toMatchObject({ cantidad: 2, subtotal: 20 });
    expect(agregarLinea.mock.calls[1][0]).toMatchObject({ cantidad: 1, subtotal: 10 });
  });

  it('valida los obligatorios por bebida: opcional sin elegir no bloquea, el obligatorio vacío sí', () => {
    const sinDefecto: GrupoOpcionesCarta = { ...endulzante, id: 'g-multi', minimo: 1, maximo: 2 };
    abrir(refresco([sinDefecto, topping]));
    mas(1);
    // todas iguales sin elegir: bloqueado
    expect(screen.getByRole('button', { name: /Elige las opciones obligatorias/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir por bebida' }));
    fireEvent.click(opcion(1, 'Azúcar'));
    // la Bebida 2 hereda la común (vacía): sigue bloqueado hasta elegirla
    expect(screen.getByRole('button', { name: /Elige las opciones obligatorias/ })).toBeDisabled();
    fireEvent.click(opcion(2, 'Stevia'));
    expect(boton()).toBeEnabled();
  });

  it('Copiar a todas pasa la elección de la Bebida 1 a las demás', () => {
    abrir(refresco([endulzante]));
    mas(1);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir por bebida' }));
    fireEvent.click(opcion(1, 'Stevia'));
    fireEvent.click(screen.getByRole('button', { name: 'Copiar a todas' }));
    expect(opcion(2, 'Stevia')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(boton());
    expect(agregarLinea).toHaveBeenCalledTimes(1);
    expect(agregarLinea.mock.calls[0][0]).toMatchObject({ cantidad: 2, subtotal: 22 });
  });

  it('con nombre por vaso, cada línea lleva los nombres de sus bebidas', () => {
    abrir(refresco([endulzante]), true);
    mas(1);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir por bebida' }));
    fireEvent.click(opcion(2, 'Sin azúcar'));
    fireEvent.change(document.getElementById('nombre-bebida-0') as HTMLElement, { target: { value: 'Ana' } });
    fireEvent.change(document.getElementById('nombre-bebida-1') as HTMLElement, { target: { value: 'Luis' } });
    fireEvent.click(boton());
    expect(agregarLinea.mock.calls[0][0].personas).toEqual(['Ana']);
    expect(agregarLinea.mock.calls[1][0].personas).toEqual(['Luis']);
  });
});

describe('agruparUnidadesIguales', () => {
  it('junta por opciones sin importar el orden y conserva el orden de aparición', () => {
    const u = (...ids: string[]) => ({ opciones: ids.map((id) => ({ id })) });
    const r = agruparUnidadesIguales([u('a', 'b'), u('c'), u('b', 'a'), u()]);
    expect(r.map((g) => g.length)).toEqual([2, 1, 1]);
  });
});
