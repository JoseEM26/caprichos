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

  it('CSS: chips 48px, sticky, snap, content-visibility y tarjetas compactas (2, 3, 4 y 5 columnas)', () => {
    expect(css).toMatch(/\.np-chip-cat\s*\{[^}]*min-height:\s*48px/);
    expect(css).toMatch(/\.np-categorias-wrap\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(css).toMatch(/\.np-producto\s*\{[^}]*content-visibility:\s*auto/);
    // celular angosto 2 columnas; desde 420 px 3; escritorio 4; pantallas anchas 5
    expect(css).toMatch(/\.np-grilla\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/min-width:\s*420px\)[^{]*\{\s*\.np-grilla\s*\{\s*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/min-width:\s*860px\)\s*\{\s*\.np-items\s*\{[^}]*\}\s*\.np-grilla\s*\{\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/min-width:\s*1200px\)\s*\{\s*\.np-grilla\s*\{\s*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/touch-action:\s*manipulation/);
  });

  it('CSS: container query del modal, grilla/tarjeta con display y fotos con tope', () => {
    expect(css).toMatch(/\.np-cuerpo--items\s*\{[^}]*container:\s*np\s*\/\s*inline-size/);
    expect(css).not.toMatch(/@media\s*\((min|max)-width:\s*(899|900|359)px/);
    expect(css).toMatch(/\.np-grilla\s*\{\s*display:\s*grid/);
    expect(css).toMatch(/\.np-producto\s*\{\s*display:\s*flex/);
    expect(css).toMatch(/\.np-producto-foto\s*\{[^}]*display:\s*block[^}]*max-width:\s*56px[^}]*max-height:\s*56px/);
    // franja baja de foto en escritorio
    expect(css).toMatch(/max-height:\s*52px/);
    expect(css).toMatch(/max-height:\s*62dvh/);
  });
});
