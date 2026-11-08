import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarraCategorias, TarjetaProducto } from '../componentes/SelectorCartaTactil';

const css = readFileSync(resolve(__dirname, '../nuevo-pedido-mozo.css'), 'utf8');
const prod: any = { id: 'p1', nombre: 'Café Americano', fotoUrl: '/x.jpg', precio: 8.5, tamanos: [] };

describe('Selector táctil de productos', () => {
  it('chips: activo marcado, y elegir llama al manejador', () => {
    const cats: any = [{ id: 'c1', nombre: 'Bebidas', productos: [] }];
    let elegido = '';
    render(<BarraCategorias categorias={cats} activaId="c1" alElegir={(id) => (elegido = id)} />);
    expect(screen.getByRole('button', { name: 'Bebidas' })).toHaveClass('np-chip-cat--activa');
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    expect(elegido).toBe('todas');
  });

  it('tarjeta: foto perezosa y asíncrona, precio visible', () => {
    render(<TarjetaProducto producto={prod} conImagenes alElegir={() => {}} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(screen.getByText('S/ 8.50')).toBeInTheDocument();
  });

  it('CSS: chips 48px, sticky, snap, content-visibility y 1 columna <360', () => {
    expect(css).toMatch(/\.np-chip-cat\s*\{[^}]*min-height:\s*48px/);
    expect(css).toMatch(/\.np-categorias-wrap\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(css).toMatch(/\.np-producto\s*\{[^}]*content-visibility:\s*auto/);
    expect(css).toMatch(/max-width:\s*419px\)\s*\{\s*\.np-grilla\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });

  it('CSS: container query del modal, grilla/tarjeta con display y fotos con tope', () => {
    expect(css).toMatch(/\.np-cuerpo--items\s*\{[^}]*container:\s*np\s*\/\s*inline-size/);
    expect(css).not.toMatch(/@media\s*\((min|max)-width:\s*(899|900|359)px/);
    expect(css).toMatch(/\.np-grilla\s*\{\s*display:\s*grid/);
    expect(css).toMatch(/\.np-producto\s*\{\s*display:\s*flex/);
    expect(css).toMatch(/\.np-producto-foto\s*\{[^}]*display:\s*block[^}]*max-width:\s*96px[^}]*max-height:\s*96px/);
    expect(css).toMatch(/max-height:\s*110px/);
    expect(css).toMatch(/max-height:\s*62dvh/);
  });
});
