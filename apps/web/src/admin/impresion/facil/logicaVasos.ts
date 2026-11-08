import type { ConfigEquipoImpresion } from '@caprichos/compartido';

export interface CategoriaSimple {
  id: string;
  nombre: string;
  areaId: string;
}

/** Categorías que se pueden marcar: solo las de las áreas cuyo vaso sale en esta PC. */
export const categoriasVisibles = (categorias: CategoriaSimple[], areasMarcadas: string[]) => categorias.filter((c) => areasMarcadas.includes(c.areaId));

/** Una categoría «caliente» no necesita sticker de vaso frío (por su nombre: Calientes). */
export const esCategoriaCaliente = (nombre: string) => /calient/i.test(nombre);

/** Ids marcados hoy: sin lista (null) son todas las visibles. */
export const marcadasVasos = (cfg: Pick<ConfigEquipoImpresion, 'stickerBebidaCategorias'>, visibles: CategoriaSimple[]): string[] =>
  cfg.stickerBebidaCategorias == null ? visibles.map((c) => c.id) : visibles.filter((c) => cfg.stickerBebidaCategorias!.includes(c.id)).map((c) => c.id);

/** Lista a guardar: si quedan todas marcadas vuelve a null («todas», como antes). */
export const normalizarVasos = (marcadas: string[], visibles: CategoriaSimple[]): string[] | null => (visibles.every((c) => marcadas.includes(c.id)) ? null : marcadas);

export const alternarCategoria = (cfg: Pick<ConfigEquipoImpresion, 'stickerBebidaCategorias'>, visibles: CategoriaSimple[], id: string) => {
  const m = marcadasVasos(cfg, visibles);
  return normalizarVasos(m.includes(id) ? m.filter((x) => x !== id) : [...m, id], visibles);
};

export const soloFrias = (visibles: CategoriaSimple[]) => normalizarVasos(visibles.filter((c) => !esCategoriaCaliente(c.nombre)).map((c) => c.id), visibles);

/** «Se imprimirán stickers de: A, B · No: C» */
export function resumenVasos(cfg: Pick<ConfigEquipoImpresion, 'stickerBebidaCategorias'>, visibles: CategoriaSimple[]) {
  const m = marcadasVasos(cfg, visibles);
  return { si: visibles.filter((c) => m.includes(c.id)).map((c) => c.nombre), no: visibles.filter((c) => !m.includes(c.id)).map((c) => c.nombre) };
}

/**
 * Categorías de bebida cuyo sticker no imprime ninguna PC (informativo): entre las de las áreas que alguna PC con
 * etiquetera toma, las que ninguna de esas PC tiene marcadas.
 */
export function categoriasSinPc(categorias: CategoriaSimple[], configs: ConfigEquipoImpresion[]): string[] {
  const activas = configs.filter((c) => c.etiquetera && !c.pausado && c.configurado);
  const areas = new Set(activas.flatMap((c) => c.stickerBebidaAreas));
  return categorias
    .filter((c) => areas.has(c.areaId))
    .filter((c) => !activas.some((p) => p.stickerBebidaAreas.includes(c.areaId) && (p.stickerBebidaCategorias == null || p.stickerBebidaCategorias.includes(c.id))))
    .map((c) => c.nombre);
}
