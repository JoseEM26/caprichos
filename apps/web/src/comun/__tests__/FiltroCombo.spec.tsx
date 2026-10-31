import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FiltroCombo } from '../FiltroCombo';

const opciones = [
  { valor: 'todos', etiqueta: 'Todos', cantidad: 12 },
  { valor: 'nuevo', etiqueta: 'Por confirmar', cantidad: 3 },
  { valor: 'listo', etiqueta: 'Listos', cantidad: 4 },
];

describe('FiltroCombo', () => {
  it('muestra la etiqueta y la opción elegida con su cantidad, sin una fila de botones', () => {
    render(<FiltroCombo etiqueta="Estado" valor="todos" opciones={opciones} alCambiar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Estado: Todos' })).toBeTruthy();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('al abrir lista las opciones con su cantidad, elegir cambia el valor y cierra', () => {
    const alCambiar = vi.fn();
    render(<FiltroCombo etiqueta="Estado" valor="todos" opciones={opciones} alCambiar={alCambiar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Estado: Todos' }));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.click(screen.getByRole('option', { name: /Por confirmar/ }));
    expect(alCambiar).toHaveBeenCalledWith('nuevo');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('Escape cierra y el filtro activo se resalta cuando no es el valor por defecto', () => {
    render(<FiltroCombo etiqueta="Estado" valor="listo" opciones={opciones} alCambiar={vi.fn()} />);
    const boton = screen.getByRole('button', { name: 'Estado: Listos' });
    expect(boton.style.border).toContain('var(--cp-orange');
    fireEvent.click(boton);
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});
