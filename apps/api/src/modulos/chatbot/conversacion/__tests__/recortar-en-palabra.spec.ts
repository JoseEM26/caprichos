import { recortarEnPalabra } from '../flujos/pedido/flujo-pedido';

describe('recortarEnPalabra', () => {
  it('no corta una palabra a la mitad y cabe en 72', () => {
    const t = 'S/ 33.00 · ¡Más sabor, más antojo, más momentos juntos! 2 Bebidas (cualquier tamaño)';
    const r = recortarEnPalabra(t, 72);
    expect(r.length).toBeLessThanOrEqual(72);
    expect(r.endsWith('…')).toBe(true);
    expect(r).not.toContain('(cualq');
  });
  it('deja igual lo que ya cabe', () => {
    expect(recortarEnPalabra('S/ 5.00', 72)).toBe('S/ 5.00');
  });
});
