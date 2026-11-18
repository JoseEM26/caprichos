import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Estructura estable del modal en tablet: panel acotado, cuerpo con scroll y pedido sin position:fixed.
const base = resolve(__dirname, '..');
const css = readFileSync(resolve(base, 'nuevo-pedido-mozo.css'), 'utf8');
const tsx = readFileSync(resolve(base, 'componentes/ModalNuevoPedidoMesa.tsx'), 'utf8');

describe('layout del modal Nuevo pedido', () => {
  it('el panel y el cuerpo llevan las clases que fijan cabecera y pie', () => {
    expect(tsx).toContain('salon-panel np-panel');
    expect(tsx).toContain('np-cuerpo np-cuerpo--items');
    expect(css).toMatch(/\.np-cuerpo\s*\{[^}]*min-height:\s*0[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.salon-panel\.np-panel\s*\{[^}]*100dvh[^}]*overflow:\s*hidden/);
  });

  it('rejilla de 3 columnas y panel del pedido ancho en tablet/escritorio', () => {
    expect(css).toMatch(/repeat\(3, minmax\(0, 1fr\)\)/);
    expect(css).toContain('minmax(400px, 42%)');
  });

  it('el pedido ya no es position:fixed y el botón de enviar queda pegado abajo', () => {
    expect(css).not.toMatch(/\.np-carrito\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.np-carrito > \.np-enviar\s*\{[^}]*position:\s*sticky/);
  });

  it('el resumen no aplasta sus bloques, las líneas hacen wrap y los botones de cantidad son redondos de 44 px', () => {
    expect(css).toMatch(/\.np-carrito > \*\s*\{[^}]*flex-shrink:\s*0/);
    expect(css).toMatch(/\.np-linea-fila\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.np-linea-nombre\s*\{[^}]*overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/\.np-qty button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px[^}]*border-radius:\s*50%/);
    expect(tsx).toContain('np-enviar');
  });

  // Ampliación: ancho casi total, filtros en una línea y fila de línea compacta (360 / 768 / 1280 px por contenedor)
  it('el tamaño del panel queda como estaba (hasta 1120 px y alto original)', () => {
    expect(tsx).toContain("width: 'min(1120px, calc(100% - 24px))'");
    expect(css).not.toMatch(/height:\s*96dvh/);
  });

  it('categorías y buscador comparten una fila; en celular (< 420 px) el buscador baja a su propia fila', () => {
    expect(tsx).toMatch(/<div className="np-filtros">\s*<BarraCategorias/);
    expect(css).toMatch(/\.np-filtros\s*\{[^}]*flex-wrap:\s*wrap/);
    expect(css).toMatch(/@container np \(max-width: 419px\)\s*\{\s*\.np-filtros > \.np-buscador\s*\{\s*flex:\s*1 1 100%/);
  });

  it('la línea compacta: acciones en iconos con aria-label; a 36 px en PC y 44 px en celular', () => {
    expect(tsx).toContain('aria-label="Quitar" title="Quitar"');
    expect(tsx).toContain('aria-label="Dar como cortesía"');
    expect(css).toMatch(/@container np \(min-width: 860px\)\s*\{\s*\.np-qty button\s*\{\s*width:\s*36px/);
    expect(css).toMatch(/@container np \(max-width: 419px\)[\s\S]*?\.np-accion\s*\{\s*min-width:\s*44px/);
  });
});
