import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaginaConocenos } from '../../../carta/PaginaConocenos';
import { CONOCENOS_DEFAULT } from '../../../carta/conocenosContenido';

describe('PaginaConocenos', () => {
  it('sin contenido muestra los textos de siempre', () => {
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} />);
    expect(screen.getByText('CONÓCENOS')).toBeTruthy();
    expect(screen.getByText('Cafetería artesanal en San Juan de Lurigancho')).toBeTruthy();
    expect(screen.getByText('Dónde estamos')).toBeTruthy();
    expect(screen.getByText('Momentos Caprichos')).toBeTruthy();
  });

  it('con contenido usa los textos y oculta bloques', () => {
    const bloques = CONOCENOS_DEFAULT.bloques.map((b) => (b.id === 'donde' ? { ...b, visible: false } : b.id === 'horario' ? { ...b, titulo: 'Cuándo abrimos' } : b));
    render(<PaginaConocenos datosLocal={null} estadoLocal={null} contenido={{ titulo: 'Hola', parrafos: ['Uno', 'Dos'], bloques }} />);
    expect(screen.getByText('Hola')).toBeTruthy();
    expect(screen.getByText('Dos')).toBeTruthy();
    expect(screen.getByText('Cuándo abrimos')).toBeTruthy();
    expect(screen.queryByText('Dónde estamos')).toBeNull();
  });
});
