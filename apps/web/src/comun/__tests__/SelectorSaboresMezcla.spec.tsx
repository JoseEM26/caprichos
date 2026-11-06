import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectorSaboresMezcla } from '../SelectorSaboresMezcla';
import type { SaborMezcla } from '../saboresMezcla';

const sabores: SaborMezcla[] = [
  { id: 'f', nombre: 'Fresa', disponible: true, quedan: 9 },
  { id: 'o', nombre: 'Oreo', disponible: true, quedan: 3 },
  { id: 'm', nombre: 'Manjar', disponible: true, quedan: null },
  { id: 'x', nombre: 'Agotada', disponible: true, quedan: 0 },
  { id: 'y', nombre: 'Inactiva', disponible: false, quedan: 8 },
];

describe('SelectorSaboresMezcla', () => {
  it('muestra solo los sabores disponibles y con stock, no los agotados', () => {
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{}} onCambio={() => {}} />);
    expect(screen.getByLabelText('Cantidad de Fresa')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Oreo')).toBeTruthy();
    expect(screen.getByLabelText('Cantidad de Manjar')).toBeTruthy();
    expect(screen.queryByLabelText('Cantidad de Agotada')).toBeNull();
    expect(screen.queryByText('Agotada', { exact: false })).toBeNull();
    expect(screen.queryByText('Inactiva', { exact: false })).toBeNull();
  });

  it('cuenta lo elegido y lo que falta, y dice cuando está completo', () => {
    const { rerender } = render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ f: 4 }} onCambio={() => {}} />);
    expect(screen.getByText('Elegidas 4 de 6')).toBeTruthy();
    expect(screen.getByText('Faltan 2')).toBeTruthy();
    rerender(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ f: 4, o: 2 }} onCambio={() => {}} />);
    expect(screen.getByText('Elegidas 6 de 6')).toBeTruthy();
    expect(screen.getByText('Completo ✓')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Sabores elegidos' }).getAttribute('aria-valuenow')).toBe('6');
  });

  it('el + de un sabor se bloquea al completar el total y al llegar a lo que queda', () => {
    const { rerender } = render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ f: 6 }} onCambio={() => {}} />);
    expect((screen.getByRole('button', { name: 'Agregar una de Oreo' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ o: 3 }} onCambio={() => {}} />);
    expect((screen.getByRole('button', { name: 'Agregar una de Oreo' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ o: 2 }} onCambio={() => {}} />);
    expect((screen.getByRole('button', { name: 'Agregar una de Oreo' }) as HTMLButtonElement).disabled).toBe(false);
    // Manjar no tiene tope propio: con 2 de 6 todavía caben 4
    expect((screen.getByRole('button', { name: 'Agregar una de Manjar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('− y + emiten el nuevo reparto; − se bloquea en cero y quita el sabor al llegar a cero', () => {
    const onCambio = vi.fn();
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ f: 1 }} onCambio={onCambio} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar una de Fresa' }));
    expect(onCambio).toHaveBeenLastCalledWith({ f: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Quitar una de Fresa' }));
    expect(onCambio).toHaveBeenLastCalledWith({});
    expect((screen.getByRole('button', { name: 'Quitar una de Oreo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('atajo «Todas del mismo sabor» reparte el total en un sabor; se desactiva si no alcanza', () => {
    const onCambio = vi.fn();
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{}} onCambio={onCambio} />);
    fireEvent.click(screen.getByRole('button', { name: 'Todas del mismo sabor: Fresa' }));
    expect(onCambio).toHaveBeenLastCalledWith({ f: 6 });
    expect((screen.getByRole('button', { name: 'Todas del mismo sabor: Oreo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Limpiar vacía el reparto y no está activo sin elegidas', () => {
    const onCambio = vi.fn();
    const { rerender } = render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ o: 2 }} onCambio={onCambio} />);
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(onCambio).toHaveBeenCalledWith({});
    rerender(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{}} onCambio={onCambio} />);
    expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('«Quedan N» solo aparece con 5 o menos', () => {
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{}} onCambio={() => {}} />);
    expect(screen.getByText('Quedan 3')).toBeTruthy();
    expect(screen.queryByText('Quedan 9')).toBeNull();
    expect(screen.queryByText(/Quedan null/)).toBeNull();
  });

  it('con deshabilitar no deja tocar nada y el grupo tiene nombre accesible', () => {
    const onCambio = vi.fn();
    render(<SelectorSaboresMezcla sabores={sabores} total={6} valor={{ f: 1 }} onCambio={onCambio} deshabilitar />);
    expect(screen.getByRole('group', { name: 'Sabores de la mezcla' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Agregar una de Fresa' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('avisa cuando sobran unidades (el total bajó)', () => {
    render(<SelectorSaboresMezcla sabores={sabores} total={2} valor={{ f: 4 }} onCambio={() => {}} />);
    expect(screen.getByText('Sobran 2: quita unidades')).toBeTruthy();
  });
});
