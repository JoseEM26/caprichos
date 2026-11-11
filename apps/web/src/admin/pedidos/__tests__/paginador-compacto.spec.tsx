import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PaginadorCaja, type PaginadorCajaProps } from '../PaginadorCaja';

afterEach(cleanup);

const base: PaginadorCajaProps = { total: 40, desde: 1, hasta: 25, pagina: 1, totalPaginas: 2, alIr: () => {}, filas: 25, alCambiarFilas: () => {}, conAuto: false };

describe('PaginadorCaja compacto', () => {
  it('varias páginas: nav con nombre, conteo, filas, anterior/siguiente accesibles y «Página 1 de 2»', () => {
    const alIr = vi.fn();
    render(<PaginadorCaja {...base} alIr={alIr} />);
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toBeTruthy();
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–25 de 40');
    expect(screen.getByRole('combobox', { name: 'Filas por página' })).toBeTruthy();
    expect(screen.getByText('Página 1 de 2')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(alIr).toHaveBeenCalledWith(2);
  });

  it('una sola página con más de 10 filas: oculta «Página 1 de 1» y las flechas, pero deja el conteo y el selector de filas', () => {
    render(<PaginadorCaja {...base} total={12} hasta={12} totalPaginas={1} filas="todas" />);
    expect(screen.queryByText(/Página 1 de 1/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Página anterior' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Página siguiente' })).toBeNull();
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–12 de 12');
    expect(screen.getByRole('combobox', { name: 'Filas por página' })).toBeTruthy();
  });

  it('10 filas o menos: el selector no aporta, solo queda el conteo', () => {
    render(<PaginadorCaja {...base} total={5} hasta={5} totalPaginas={1} filas="todas" />);
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('Mostrando 1–5 de 5');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('0 elementos: solo el conteo', () => {
    render(<PaginadorCaja {...base} total={0} desde={0} hasta={0} totalPaginas={1} unidad="ventas" />);
    expect(screen.getByTestId('rango-pagina')).toHaveTextContent('0 ventas');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('5 o más páginas: primera/última y salto a una página', () => {
    const alIr = vi.fn();
    render(<PaginadorCaja {...base} pagina={3} totalPaginas={6} alIr={alIr} />);
    fireEvent.click(screen.getByRole('button', { name: 'Última página' }));
    expect(alIr).toHaveBeenCalledWith(6);
    fireEvent.change(screen.getByRole('combobox', { name: 'Ir a la página' }), { target: { value: '2' } });
    expect(alIr).toHaveBeenCalledWith(2);
  });

  it('carga progresiva en la MISMA línea: «Cargar más» es un enlace chico y «Cargando…» un texto, sin segunda barra', () => {
    const alCargarMas = vi.fn();
    const { rerender } = render(<PaginadorCaja {...base} carga={{ cargados: 200, totalServidor: 253, cargando: false, alCargarMas }} />);
    expect(screen.getAllByRole('navigation', { name: 'Paginación' })).toHaveLength(1);
    expect(screen.getByTestId('pag-carga')).toHaveTextContent('200/253');
    const boton = screen.getByRole('button', { name: 'Cargar más' });
    expect(boton).toHaveClass('cj2-pag-mas');
    expect(screen.getByRole('navigation', { name: 'Paginación' })).toContainElement(boton);
    fireEvent.click(boton);
    expect(alCargarMas).toHaveBeenCalledTimes(1);
    rerender(<PaginadorCaja {...base} carga={{ cargados: 200, totalServidor: 253, cargando: true, alCargarMas }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando… 200/253');
    expect(screen.queryByRole('button', { name: /Cargar|Cargando/ })).toBeNull();
    rerender(<PaginadorCaja {...base} carga={{ cargados: 253, totalServidor: 253, cargando: false, alCargarMas }} />);
    expect(screen.queryByTestId('pag-carga')).toBeNull();
  });
});
