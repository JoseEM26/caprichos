import { describe, it, expect } from 'vitest';
import { TEMAS, contraste, temaDeDecoracion } from '../celebracion/temas';

describe('temáticas de la celebración del pedido', () => {
  it('elige el tema según la decoración de la carta (mayúsculas y alias incluidos)', () => {
    expect(temaDeDecoracion('NAVIDAD').id).toBe('navidad');
    expect(temaDeDecoracion('halloween').escenario).toBe('halloween');
    expect(temaDeDecoracion('patrias').id).toBe('patrias');
    expect(temaDeDecoracion('fiestas_patrias').id).toBe('patrias');
    expect(temaDeDecoracion('san_valentin').id).toBe('sanvalentin');
    expect(temaDeDecoracion('anonuevo').escenario).toBe('fuegos');
    expect(temaDeDecoracion('verano').id).toBe('verano');
  });

  it('sin decoración, «ninguno» o desconocida: clásico Caprichos', () => {
    for (const d of [undefined, null, '', 'NINGUNO', 'normal', 'inventada']) expect(temaDeDecoracion(d).id).toBe('clasico');
  });

  it('el cartel y el botón de cada tema cumplen contraste AA (4.5:1)', () => {
    for (const t of Object.values(TEMAS)) {
      expect(contraste(t.cartel.tinta, t.cartel.fondo), `${t.id} título`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.cartel.acento, t.cartel.fondo), `${t.id} código`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(t.boton.tinta, t.boton.fondo), `${t.id} botón`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
