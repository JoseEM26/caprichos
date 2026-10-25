import { useMemo } from 'react';
import { OfertaItem } from '../admin/ofertas/ofertasApi';
import { CategoriaCarta, ProductoCarta } from './tipos';

/**
 * Calcula un puntaje de beneficio relativo para comparar promociones y elegir la de mayor beneficio.
 */
export function calcularValorBeneficio(o: OfertaItem): number {
  if (o.tipo === 'LLEVA_PAGA') {
    const lleva = o.lleva || 2;
    const paga = o.paga || 1;
    if (lleva > paga) {
      return ((lleva - paga) / lleva) * 100;
    }
    return 10;
  }
  if (o.tipo === 'DESCUENTO') {
    if (o.descuentoTipo === 'PORCENTAJE') {
      return Number(o.descuentoValor) || 0;
    }
    return Number(o.descuentoValor) || 0;
  }
  return 0;
}

/**
 * Formatea la etiqueta corta para la insignia del producto:
 * '2x1 hoy', 'Lleva 3 paga 2', '-15 %', '-S/ 5' (sin emojis).
 */
export function formatearEtiquetaBeneficio(o: OfertaItem): string {
  if (o.tipo === 'LLEVA_PAGA') {
    const lleva = o.lleva || 2;
    const paga = o.paga || 1;
    if (lleva === 2 && paga === 1) {
      return '2x1 hoy';
    }
    return `Lleva ${lleva} paga ${paga}`;
  }
  if (o.tipo === 'DESCUENTO') {
    if (o.descuentoTipo === 'PORCENTAJE') {
      return `-${o.descuentoValor || 0} %`;
    }
    return `-S/ ${o.descuentoValor || 0}`;
  }
  return '';
}

/**
 * Determina si un producto es o pertenece a un combo para excluirlo de descuentos y 2x1.
 */
export function esProductoCombo(producto: ProductoCarta, categoriaNombre?: string): boolean {
  if (categoriaNombre && /combo/i.test(categoriaNombre)) return true;
  if (/^combo\b/i.test(producto.nombre.trim())) return true;
  if (Array.isArray(producto.grupos) && producto.grupos.some((g) => g.nombre.includes(' · '))) {
    return true;
  }
  return false;
}

/**
 * Mapea productoId -> etiqueta de beneficio para los productos de la carta.
 */
export function calcularMapaBeneficios(
  ofertas: OfertaItem[],
  categorias: CategoriaCarta[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  if (!Array.isArray(ofertas) || ofertas.length === 0) return mapa;

  // Filtrar ofertas vigentes hoy y que no sean combos
  const ofertasVigentes = ofertas.filter(
    (o) => o.activo !== false && o.vigenteAhora === true && o.tipo !== 'COMBO',
  );
  if (ofertasVigentes.length === 0) return mapa;

  for (const cat of categorias) {
    for (const prod of cat.productos) {
      // Regla: no aplica a combos ni noSumaBeneficios
      if (prod.noSumaBeneficios) continue;
      if (esProductoCombo(prod, cat.nombre)) continue;

      // Buscar ofertas que apliquen a este producto
      const ofertasAplicables = ofertasVigentes.filter((o) => {
        if (o.noSumaBeneficios) return false;

        // Por producto directo
        if (o.alcanceProductoId && String(o.alcanceProductoId) === String(prod.id)) {
          return true;
        }
        // Por categoría
        if (o.alcanceCategoriaId && String(o.alcanceCategoriaId) === String(cat.id)) {
          return true;
        }
        return false;
      });

      if (ofertasAplicables.length === 0) continue;

      // Si cae en varias, elegir la de mayor beneficio
      ofertasAplicables.sort((a, b) => calcularValorBeneficio(b) - calcularValorBeneficio(a));
      const mejorOferta = ofertasAplicables[0];
      const etiqueta = formatearEtiquetaBeneficio(mejorOferta);
      if (etiqueta) {
        mapa.set(String(prod.id), etiqueta);
      }
    }
  }

  return mapa;
}

export function useBeneficiosCarta(
  ofertas: OfertaItem[],
  categorias: CategoriaCarta[],
): Map<string, string> {
  return useMemo(() => calcularMapaBeneficios(ofertas, categorias), [ofertas, categorias]);
}
