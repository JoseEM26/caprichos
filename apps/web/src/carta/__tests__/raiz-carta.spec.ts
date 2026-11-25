import { describe, it, expect } from 'vitest';
import type { ContenidoCarta } from '../CartaPublica';
import { esCategoriaBebida, estiloRaizCarta, ZOOM_CELULAR } from '../RaizCarta';
import { aProductoCarta } from '../../admin/catalogo/aProductoCarta';

const contenido = (decoracion: string) =>
  ({ decoracion, paleta: { accent: '#C62828', bg: '#FFF4E0', otro: '#000' }, novedades: [], destacadas: [], rankingMes: [], banner: {}, organizacion: 'SECCIONES' }) as unknown as ContenidoCarta;

describe('estiloRaizCarta (raíz compartida por la carta y las vistas previas)', () => {
  it('celular: zoom, fondo y paleta del diseñador', () => {
    const e = estiloRaizCarta(contenido('NAVIDAD'), true) as Record<string, unknown>;
    expect(e.zoom).toBe(ZOOM_CELULAR);
    expect(e.backgroundColor).toBe('var(--cp-cream)');
    expect(e['--cp-orange']).toBe('#C62828');
    expect(e['--cp-cream']).toBe('#FFF4E0');
    expect(e['otro']).toBeUndefined();
  });
  it('PC sin zoom y decoración NINGUNO ignora la paleta', () => {
    const e = estiloRaizCarta(contenido('ninguno'), false) as Record<string, unknown>;
    expect(e.zoom).toBe(1);
    expect(e['--cp-orange']).toBeUndefined();
  });
  it('bebidas por categoría', () => {
    expect(esCategoriaBebida('Frappes')).toBe(true);
    expect(esCategoriaBebida('POSTRES')).toBe(false);
  });
});

describe('aProductoCarta: campos de stock y ficha que pinta la carta', () => {
  it('pasa stock, unidades, porciones y alérgenos', () => {
    const p = aProductoCarta({
      nombre: 'Dona', precio: 5, controlaStock: true, quedan: 3, porciones: ' 2 personas ', alergenos: ['gluten'], alergenosConfirmados: true,
      tamanos: [{ nombre: 'Media docena', precio: 25, unidades: 6 }],
    });
    expect(p.controlaStock).toBe(true);
    expect(p.quedan).toBe(3);
    expect(p.porciones).toBe('2 personas');
    expect(p.alergenosConfirmados).toBe(true);
    expect(p.tamanos[0].unidades).toBe(6);
  });
});
