import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Paginador, usePaginacion } from '../comun/Paginacion';
import { rangoDePreset } from '../comun/fechas';

const NUMEROS = Array.from({ length: 70 }, (_, i) => i + 1);

function Prueba({ items = NUMEROS }: { items?: number[] }) {
  const [par, setPar] = useState(false);
  const lista = par ? items.filter((n) => n % 2 === 0) : items;
  const p = usePaginacion(lista, par);
  return (
    <>
      <button type="button" onClick={() => setPar(true)}>
        Solo pares
      </button>
      <ul>
        {p.filas.map((n) => (
          <li key={n}>{`n${n}`}</li>
        ))}
      </ul>
      <Paginador p={p} />
    </>
  );
}

describe('Paginación de Análisis', () => {
  it('10 por página, contador y navegación', () => {
    render(<Prueba />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Mostrando 1–10 de 70')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '‹ Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(screen.getByText('n11')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 11–20 de 70')).toBeInTheDocument();
  });

  it('cambia el tamaño a 25 y 50', () => {
    render(<Prueba />);
    fireEvent.change(screen.getByLabelText('Filas'), { target: { value: '25' } });
    expect(screen.getAllByRole('listitem')).toHaveLength(25);
    fireEvent.change(screen.getByLabelText('Filas'), { target: { value: '50' } });
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(screen.getByText('Mostrando 51–70 de 70')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente ›' })).toBeDisabled();
  });

  it('vuelve a la página 1 cuando cambia el filtro', () => {
    render(<Prueba />);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ›' }));
    expect(screen.getByText('Página 3 de 7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Solo pares' }));
    expect(screen.getByText('Página 1 de 4')).toBeInTheDocument();
    expect(screen.getByText('Mostrando 1–10 de 35')).toBeInTheDocument();
  });

  it('con 10 o menos filas no muestra controles', () => {
    render(<Prueba items={NUMEROS.slice(0, 10)} />);
    expect(screen.queryByRole('navigation', { name: 'Páginas' })).not.toBeInTheDocument();
  });
});

describe('Período por defecto', () => {
  it('«7d» cubre hoy y los 6 días anteriores', () => {
    expect(rangoDePreset('7d', '2026-11-15')).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });
});
