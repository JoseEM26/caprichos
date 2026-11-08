import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VistaPieza } from '../mapa/VistaPiezaEjemplo';

describe('vista previa del sticker de despacho con bloque PAGO', () => {
  it('muestra los 5 ejemplos: digital pagado, efectivo con vuelto, dividido, personal y delivery contra entrega', () => {
    const { container } = render(<VistaPieza clave="RESUMEN" />);
    const svgs = [...container.querySelectorAll('svg')];
    // nombre normal, nombre largo + 4 variantes
    expect(svgs.length).toBeGreaterThanOrEqual(6);
    const texto = svgs.map((s) => [...s.querySelectorAll('text')].map((t) => t.textContent).join('|'));
    const todo = texto.join('\n');
    expect(todo).toContain('YA PAGADO');
    expect(todo).toContain('Paga con S/ 50.00 · Vuelto S/ 11.50');
    expect(todo).toContain('Sin vuelto (paga exacto)');
    expect(todo).toContain('CONSUMO DEL PERSONAL · a su crédito');
    expect(todo).toContain('COBRAR AL ENTREGAR: S/ 38.50');
    expect(todo).toContain('YAPE');
  });
});
