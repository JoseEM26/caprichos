import { describe, it, expect } from 'vitest';
import { bebidasFijasCombo, envasesCombo, partesEleccion } from '../ReemplazoCombo';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';

// Cajita: frappé fijo (bebida) + nuggets fijos (no bebida) + 2 juguetes a elegir
const oferta = {
  id: '1', tipo: 'COMBO', nombre: 'Cajita',
  combosParte: [
    { id: '10', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['1'], principalNombre: 'FRAPPE OREO', bebidaFija: true },
    { id: '11', tipo: 'FIJO', cantidad: 1, categorias: [], productos: ['2'], principalNombre: 'NUGGETS' },
    { id: '12', tipo: 'A_ELECCION', cantidad: 2, categorias: [], productos: ['20', '21'], opcionesDetalle: [{ id: '20', nombre: 'Carrito', disponible: true }] },
  ],
} as unknown as OfertaItem;

describe('Combo con una bebida fija: su vaso también lleva nombre', () => {
  it('cuenta solo las bebidas fijas, no los nuggets ni los juguetes', () => {
    expect(bebidasFijasCombo(oferta)).toEqual([{ nombre: 'FRAPPE OREO', cantidad: 1 }]);
  });

  it('el envase de la bebida fija sale con su producto; sin bebidas fijas no cuenta nada', () => {
    expect(envasesCombo(oferta, partesEleccion(oferta), {})).toEqual(['FRAPPE OREO']);
    expect(bebidasFijasCombo({ combosParte: [] } as unknown as OfertaItem)).toEqual([]);
    expect(bebidasFijasCombo(null)).toEqual([]);
  });

  it('una bebida fija con alternativa activa (sin stock) ya no cuenta como fija', () => {
    const conAlt = { combosParte: [{ ...oferta.combosParte![0], alternativasActivas: true }] } as unknown as OfertaItem;
    expect(bebidasFijasCombo(conAlt)).toEqual([]);
  });
});
