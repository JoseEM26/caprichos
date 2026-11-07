jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { lineasDeArea } from './comandas.service';

/**
 * Un combo se arma con partes: la línea madre (sin producto ni área) no va a ninguna cocina y cada parte
 * sale en el área de su propio producto. El combo nunca se agrupa en la categoría «Combos» ni en su área.
 */
describe('cocina: líneas de un combo', () => {
  const AREA_BEBIDAS = 1n;
  const AREA_DULCES = 2n;
  const AREA_SALADOS = 3n;
  const lineas = [
    { id: 1n, nombre: 'Dúo Compartir', cantidad: 1, producto_id: null, area_id: null, producto: null, linea_combo_id: null },
    { id: 2n, nombre: 'Frappé', cantidad: 2, producto_id: 10n, area_id: AREA_BEBIDAS, producto: { categoria: { area_id: AREA_BEBIDAS } }, linea_combo_id: 1n },
    { id: 3n, nombre: 'Dona', cantidad: 2, producto_id: 11n, area_id: AREA_DULCES, producto: { categoria: { area_id: AREA_DULCES } }, linea_combo_id: 1n },
    { id: 4n, nombre: 'Galleta', cantidad: 2, producto_id: 12n, area_id: AREA_DULCES, producto: { categoria: { area_id: AREA_DULCES } }, linea_combo_id: 1n },
  ];

  it('cada parte en el área de su producto', () => {
    expect(lineasDeArea(lineas, AREA_BEBIDAS).map((l) => l.nombre)).toEqual(['Frappé']);
    expect(lineasDeArea(lineas, AREA_DULCES).map((l) => l.nombre)).toEqual(['Dona', 'Galleta']);
  });

  it('la línea madre del combo no aparece en ninguna área (ni en Salados)', () => {
    for (const area of [AREA_BEBIDAS, AREA_DULCES, AREA_SALADOS]) {
      expect(lineasDeArea(lineas, area).map((l) => l.nombre)).not.toContain('Dúo Compartir');
    }
  });
});
