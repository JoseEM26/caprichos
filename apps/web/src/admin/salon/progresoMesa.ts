import type { ProgresoPedido } from './tipos';

/** Piezas listas ÷ totales de un pedido o de una mesa, con el desglose por área de cocina. */
export interface ProgresoPiezas {
  total: number;
  listas: number;
  porcentaje: number;
  porArea: Array<{ nombre: string; total: number; listas: number }>;
}

const VACIO: ProgresoPiezas = { total: 0, listas: 0, porcentaje: 0, porArea: [] };

const pct = (listas: number, total: number) => (total > 0 ? Math.min(100, Math.round((listas * 100) / total)) : 0);

/**
 * Progreso de UN pedido. Si la API ya trae {total, listas, porArea} se usa tal cual; si no, se calcula de
 * progreso.areas[].productos (cantidad vs listas; el pedido anulado no cuenta). Sin datos: 0 de 0.
 */
export function progresoDePiezas(progreso?: ProgresoPedido | null, estado?: string | null): ProgresoPiezas {
  if (!progreso || estado === 'ANULADO' || estado === 'RECHAZADO' || progreso.etapa === 'ANULADO') return VACIO;
  const api = progreso as unknown as { total?: unknown; listas?: unknown; porArea?: unknown };
  if (typeof api.total === 'number' && typeof api.listas === 'number') {
    const porArea = Array.isArray(api.porArea) ? (api.porArea as ProgresoPiezas['porArea']) : [];
    return { total: api.total, listas: api.listas, porcentaje: pct(api.listas, api.total), porArea };
  }
  const porArea = (progreso.areas ?? []).map((a) => {
    const prods = a.productos ?? [];
    const total = prods.reduce((s, p) => s + Math.max(0, p.cantidad), 0);
    const listas = prods.reduce((s, p) => s + Math.min(Math.max(0, p.cantidad), Math.max(0, p.listas ?? 0)), 0);
    return { nombre: a.nombre, total, listas };
  });
  return juntarProgresos(porArea.length ? [{ total: 0, listas: 0, porcentaje: 0, porArea }] : []);
}

/** Suma varios progresos (pedido original + extras) y agrupa las áreas por nombre. */
export function juntarProgresos(lista: ProgresoPiezas[]): ProgresoPiezas {
  const areas = new Map<string, { nombre: string; total: number; listas: number }>();
  for (const p of lista) {
    for (const a of p.porArea) {
      const x = areas.get(a.nombre) ?? { nombre: a.nombre, total: 0, listas: 0 };
      x.total += a.total;
      x.listas += a.listas;
      areas.set(a.nombre, x);
    }
  }
  const porArea = [...areas.values()];
  // Un progreso de la API sin desglose por área aporta su total propio
  const sinDesglose = lista.filter((p) => p.porArea.length === 0);
  const total = porArea.reduce((s, a) => s + a.total, 0) + sinDesglose.reduce((s, p) => s + p.total, 0);
  const listas = porArea.reduce((s, a) => s + a.listas, 0) + sinDesglose.reduce((s, p) => s + p.listas, 0);
  return { total, listas, porcentaje: pct(listas, total), porArea };
}
