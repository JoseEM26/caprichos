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
});
