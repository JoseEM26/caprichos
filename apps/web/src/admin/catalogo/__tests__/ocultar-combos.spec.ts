import { describe, it, expect } from 'vitest';
import { ocultarCombos } from '../ocultarCombos';

const cat = (id: string, nombre: string) => ({ id, nombre, areaId: '1', orden: 0, oculta: false, llevaOpciones: false });
const prod = (id: string, categoriaId: string, esAnfitrionCombo?: boolean) => ({ id, categoriaId, nombre: 'P' + id, esAnfitrionCombo }) as any;

describe('ocultarCombos', () => {
  it('quita anfitriones y la categoría Combos, sin tocar lo demás', () => {
    const r = ocultarCombos(
      [prod('1', '10'), prod('2', '20', true), prod('3', '20', true), prod('4', '30', true)],
      [cat('10', 'Salados'), cat('20', 'Combos'), cat('30', 'Cajitas')],
    );
    expect(r.productos.map((p) => p.id)).toEqual(['1']);
    expect(r.categorias.map((c) => c.id)).toEqual(['10']);
    expect(r.combosOcultos).toBe(3);
  });
  it('un anfitrión en una categoría normal se oculta pero la categoría queda', () => {
    const r = ocultarCombos([prod('1', '10'), prod('2', '10', true)], [cat('10', 'Dulces')]);
    expect(r.productos.map((p) => p.id)).toEqual(['1']);
    expect(r.categorias).toHaveLength(1);
  });
  it('un producto común dentro de la categoría Combos (p. ej. el Dúo viejo) NO se oculta', () => {
    const r = ocultarCombos([prod('1', '20'), prod('2', '20', true)], [cat('20', 'Combos')]);
    expect(r.productos.map((p) => p.id)).toEqual(['1']);
    expect(r.categorias.map((c) => c.id)).toEqual(['20']);
  });
});
