import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BarraFiltros, FiltroCombo } from '../FiltroCombo';

describe('BarraFiltros', () => {
  it('pone los hijos en una fila flex con wrap, uno al lado del otro', () => {
    render(
      <BarraFiltros>
        <input aria-label="Buscar" />
        <FiltroCombo etiqueta="Estado" valor="todos" opciones={[{ valor: 'todos', etiqueta: 'Todos' }]} alCambiar={() => {}} />
        <FiltroCombo etiqueta="Canal" valor="todos" opciones={[{ valor: 'todos', etiqueta: 'Todos' }]} alCambiar={() => {}} />
      </BarraFiltros>,
    );
    const fila = screen.getByLabelText('Buscar').parentElement as HTMLElement;
    expect(fila.style.display).toBe('flex');
    expect(fila.style.flexWrap).toBe('wrap');
    expect(fila.style.gap).toBe('8px');
    expect(fila.children).toHaveLength(3);
    const combo = screen.getByRole('button', { name: 'Estado: Todos' }).parentElement as HTMLElement;
    expect(combo.style.flex).toBe('1 1 160px');
  });
});
