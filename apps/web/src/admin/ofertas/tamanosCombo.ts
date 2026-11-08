/**
 * Tamaños del combo: se HEREDAN de las bebidas. Cada tamaño es un valor real de la lista TAMANO (tamanoValorId), no un nombre
 * suelto, para que al pedir el combo en «Grande» cada bebida use su propio «Grande».
 */
import type { CategoriaEditor, Parte, ProductoEditor } from './partesComboModelo';
import { productosDeLaParte, tipoDe } from './partesComboModelo';

export interface TamanoHeredado {
  valorId: string;
  nombre: string;
  /** Todas las bebidas del combo tienen este tamaño. */
  enTodas: boolean;
}

/**
 * Unión de los tamaños reales de los productos de las partes a elegir (los complementos con paquete no cuentan),
 * marcando los que no tienen todas. Orden: el de la bebida con más tamaños.
 */
export function tamanosHeredados(partes: Parte[], productos: ProductoEditor[], categorias: CategoriaEditor[]): TamanoHeredado[] {
  const bebidas = new Map<string, ProductoEditor>();
  for (const p of partes) {
    if (tipoDe(p) === 'FIJO' || p.paqueteGrupo) continue;
    for (const prod of productosDeLaParte(p, productos, categorias)) bebidas.set(prod.id, prod);
  }
  const conTamanos = [...bebidas.values()].filter((b) => (b.tamanos ?? []).some((t) => t.valorId));
  const orden = new Map<string, TamanoHeredado>();
  for (const b of [...conTamanos].sort((a, c) => (c.tamanos?.length ?? 0) - (a.tamanos?.length ?? 0))) {
    for (const t of b.tamanos ?? []) {
      if (t.valorId && !orden.has(t.valorId)) orden.set(t.valorId, { valorId: t.valorId, nombre: t.nombre, enTodas: true });
    }
  }
  for (const h of orden.values()) h.enTodas = conTamanos.every((b) => (b.tamanos ?? []).some((t) => t.valorId === h.valorId));
  return [...orden.values()];
}

export interface TamanoCombo {
  tamanoValorId?: string;
  tamanoNombre: string;
  precio: number;
  /** Solo en pantalla: apagado (o sin precio) = el tamaño no se ofrece ni se guarda. */
  activo?: boolean;
}

/** Suma los heredados que falten (sin pisar precios). `activarNuevos`: combo nuevo; si no, quedan apagados. */
export function mezclarTamanos(actuales: TamanoCombo[], heredados: TamanoHeredado[], activarNuevos: boolean): TamanoCombo[] {
  // La fila de relleno («Regular» sin valor ni precio) sobra cuando ya hay tamaños heredados
  if (heredados.length > 0) actuales = actuales.filter((t) => t.tamanoValorId || Number(t.precio) > 0);
  const ya = new Set(actuales.map((t) => t.tamanoValorId).filter(Boolean));
  const nuevos = heredados
    .filter((h) => !ya.has(h.valorId))
    .map((h) => ({ tamanoValorId: h.valorId, tamanoNombre: h.nombre, precio: 0, activo: activarNuevos }));
  return nuevos.length === 0 ? actuales : [...actuales, ...nuevos];
}

/** Lo que se guarda: tamaños activos con precio. */
export const tamanosVigentes = (ts: TamanoCombo[]): TamanoCombo[] => ts.filter((t) => t.activo !== false && Number(t.precio) > 0);
