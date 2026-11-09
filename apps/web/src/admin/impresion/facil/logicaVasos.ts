import { categoriasBebidaEfectivas, type BebidaCategoriasPorModalidad, type ConfigEquipoImpresion } from '@caprichos/compartido';

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

// ───── Por tipo de pedido ─────
/** Columnas de la matriz: «Llevar / recoger» es una sola (se guarda como LLEVAR; el servidor la aplica también a RECOGER). */
export type TipoPedidoVaso = 'COMER_LOCAL' | 'LLEVAR' | 'DELIVERY';
export const TIPOS_VASO: Array<{ id: TipoPedidoVaso; icono: string; corto: string; frase: string }> = [
  { id: 'COMER_LOCAL', icono: '🍽️', corto: 'En el local', frase: 'en el local' },
  { id: 'LLEVAR', icono: '🥡', corto: 'Llevar / recoger', frase: 'para llevar o recoger' },
  { id: 'DELIVERY', icono: '🛵', corto: 'Delivery', frase: 'en delivery' },
];

type CfgVasos = Pick<ConfigEquipoImpresion, 'stickerBebidaCategorias' | 'stickerBebidaCategoriasPorModalidad'>;

/** «Usar la misma regla para todos»: no hay ninguna regla propia por tipo de pedido. */
export const mismaReglaParaTodos = (cfg: Pick<ConfigEquipoImpresion, 'stickerBebidaCategoriasPorModalidad'>) =>
  !cfg.stickerBebidaCategoriasPorModalidad || Object.keys(cfg.stickerBebidaCategoriasPorModalidad).length === 0;

/** Lista efectiva de un tipo de pedido (la suya, si no la general; null = todas). */
export const listaDeTipo = (cfg: CfgVasos, tipo: TipoPedidoVaso) => categoriasBebidaEfectivas(cfg.stickerBebidaCategorias, cfg.stickerBebidaCategoriasPorModalidad, tipo);

export const marcadasDeTipo = (cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso): string[] => {
  const l = listaDeTipo(cfg, tipo);
  return l == null ? visibles.map((c) => c.id) : visibles.filter((c) => l.includes(c.id)).map((c) => c.id);
};

/**
 * Nueva regla por tipo tras marcar `marcadas` en `tipo`. Si coincide con la general se quita la clave (= igual que la
 * general); con la general en «todas», «Marcar todo» queda en null. Con una general restrictiva, «todas» se guarda como
 * lista completa (null en ese tipo significaría «la general»).
 */
export function ponerTipo(cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso, marcadas: string[]): BebidaCategoriasPorModalidad | null {
  const previo = { ...(cfg.stickerBebidaCategoriasPorModalidad ?? {}) };
  const general = cfg.stickerBebidaCategorias == null ? visibles.map((c) => c.id) : visibles.filter((c) => cfg.stickerBebidaCategorias!.includes(c.id)).map((c) => c.id);
  const igual = general.length === marcadas.length && general.every((x) => marcadas.includes(x));
  if (igual) delete previo[tipo];
  else previo[tipo] = visibles.filter((c) => marcadas.includes(c.id)).map((c) => c.id);
  return Object.keys(previo).length ? previo : null;
}

export const alternarCategoriaTipo = (cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso, id: string) => {
  const m = marcadasDeTipo(cfg, visibles, tipo);
  return ponerTipo(cfg, visibles, tipo, m.includes(id) ? m.filter((x) => x !== id) : [...m, id]);
};
export const soloFriasTipo = (cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso) => ponerTipo(cfg, visibles, tipo, visibles.filter((c) => !esCategoriaCaliente(c.nombre)).map((c) => c.id));
export const todasTipo = (cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso) => ponerTipo(cfg, visibles, tipo, visibles.map((c) => c.id));

/** «En el local: Frappes, Iced · No: Calientes» / «Delivery: todas» / «Delivery: ninguna» */
export function resumenTipo(cfg: CfgVasos, visibles: CategoriaSimple[], tipo: TipoPedidoVaso): string {
  const m = marcadasDeTipo(cfg, visibles, tipo);
  const si = visibles.filter((c) => m.includes(c.id)).map((c) => c.nombre);
  const no = visibles.filter((c) => !m.includes(c.id)).map((c) => c.nombre);
  const nombre = TIPOS_VASO.find((t) => t.id === tipo)!.corto;
  if (no.length === 0) return `${nombre}: todas`;
  return `${nombre}: ${si.length ? si.join(', ') : 'ninguna'}${si.length ? ` · No: ${no.join(', ')}` : ''}`;
}

/**
 * Categorías de bebida cuyo sticker no imprime ninguna PC (informativo), con los tipos de pedido en los que falta.
 * Entre las de las áreas que alguna PC con etiquetera toma, las que ninguna de esas PC tiene marcadas en ese tipo.
 */
export function categoriasSinPcPorTipo(categorias: CategoriaSimple[], configs: ConfigEquipoImpresion[]): Array<{ nombre: string; tipos: TipoPedidoVaso[] }> {
  const activas = configs.filter((c) => c.etiquetera && !c.pausado && c.configurado);
  const areas = new Set(activas.flatMap((c) => c.stickerBebidaAreas));
  return categorias
    .filter((c) => areas.has(c.areaId))
    .map((c) => ({
      nombre: c.nombre,
      tipos: TIPOS_VASO.map((t) => t.id).filter(
        (t) => !activas.some((p) => p.stickerBebidaAreas.includes(c.areaId) && (listaDeTipo(p, t) == null || listaDeTipo(p, t)!.includes(c.id))),
      ),
    }))
    .filter((x) => x.tipos.length > 0);
}

/** Categorías que ninguna PC imprime en NINGÚN tipo de pedido (informativo). */
export function categoriasSinPc(categorias: CategoriaSimple[], configs: ConfigEquipoImpresion[]): string[] {
  return categoriasSinPcPorTipo(categorias, configs).filter((x) => x.tipos.length === TIPOS_VASO.length).map((x) => x.nombre);
}
