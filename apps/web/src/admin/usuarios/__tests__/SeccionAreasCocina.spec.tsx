import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeccionAreasCocina } from '../SeccionAreasCocina';

const DISPONIBLES = [
  { id: '1', nombre: 'Bebidas' },
  { id: '2', nombre: 'Salados' },
  { id: '3', nombre: 'Postres' },
];

describe('SeccionAreasCocina', () => {
  it('muestra una casilla por área y la nota de que sin marcar ve todas', () => {
    render(<SeccionAreasCocina disponibles={DISPONIBLES} valor={[]} alCambiar={vi.fn()} />);
    expect(screen.getByText('Áreas que atiende')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Bebidas' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Salados' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Postres' })).not.toBeChecked();
    expect(screen.getByText('Sin marcar ninguna: ve todas las áreas.')).toBeInTheDocument();
  });

  it('marca y desmarca áreas y avisa la lista completa', () => {
    const alCambiar = vi.fn();
    const { rerender } = render(<SeccionAreasCocina disponibles={DISPONIBLES} valor={['1']} alCambiar={alCambiar} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Postres' }));
    expect(alCambiar).toHaveBeenLastCalledWith(['1', '3']);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bebidas' }));
    expect(alCambiar).toHaveBeenLastCalledWith([]);
    rerender(<SeccionAreasCocina disponibles={DISPONIBLES} valor={['2']} alCambiar={alCambiar} />);
    expect(screen.getByRole('checkbox', { name: 'Salados' })).toBeChecked();
  });

  it('deshabilitada no deja cambiar nada', () => {
    const alCambiar = vi.fn();
    render(<SeccionAreasCocina disponibles={DISPONIBLES} valor={[]} alCambiar={alCambiar} deshabilitado />);
    expect(screen.getByRole('checkbox', { name: 'Bebidas' })).toBeDisabled();
  });
});
