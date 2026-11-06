import { ErrorApi } from '../comun/api';
import { maximoMezclas, type SaborMezcla } from '../comun/saboresMezcla';
import type { LineaCarrito, ProductoCarta, SaborLinea } from './tipos';

/** Hasta cuántas unidades se muestra la etiqueta «Quedan N». Ajustable. */
export const UMBRAL_QUEDAN = 5;

/** Cada cuánto, como mínimo, la carta vuelve a pedirse al abrir el carrito o el checkout. */
export const INTERVALO_REFRESCO_STOCK_MS = 20_000;

export interface InfoStock {
  controlaStock: boolean;
  /** null: sin límite (no controlado o sin conteo de apertura hoy). */
  quedan: number | null;
  disponible: boolean;
  /** Solo con saboresConStock: stock de cada sabor (null = sin tope). */
  sabores?: Record<string, { nombre: string; disponible: boolean; quedan: number | null }>;
}

/** Stock por productoId, tomado de la última carta cargada. */
export type InventarioCarta = Record<string, InfoStock>;

export interface ExcesoStock {
  productoId: string;
  nombre: string;
  pedidas: number;
  quedan: number;
  /** Con sabores: el exceso es de este sabor. */
  saborId?: string;
  saborNombre?: string;
}

export function infoStockDe(
  p: Pick<ProductoCarta, 'controlaStock' | 'quedan' | 'disponible'> & Partial<Pick<ProductoCarta, 'saboresConStock' | 'sabores'>>,
): InfoStock {
  const controla = p.controlaStock === true;
  const info: InfoStock = {
    controlaStock: controla,
    quedan: controla && typeof p.quedan === 'number' ? p.quedan : null,
    disponible: p.disponible,
  };
  if (p.saboresConStock === true) {
    info.sabores = Object.fromEntries(
      (p.sabores ?? []).map((s) => [String(s.id), { nombre: s.nombre, disponible: s.disponible, quedan: s.quedan ?? null }]),
    );
  }
  return info;
}

/** Unidades por sabor que ya están en el carrito para un producto (todas sus líneas). */
export function saboresEnCarrito(lineas: LineaCarrito[], productoId: string): Record<string, number> {
  const suma: Record<string, number> = {};
  for (const l of lineas) {
    if (String(l.productoId) !== String(productoId)) continue;
    for (const s of l.sabores ?? []) suma[s.saborId] = (suma[s.saborId] ?? 0) + s.cantidad;
  }
  return suma;
}

/**
 * Sabores disponibles para una línea: el saldo de cada sabor menos lo que ya llevan las OTRAS líneas
 * del producto (la línea que se edita no se cuenta contra sí misma).
 */
export function saboresParaLinea(info: InfoStock, lineas: LineaCarrito[], productoId: string, lineaId?: string): SaborMezcla[] {
  const usadas: Record<string, number> = {};
  for (const l of lineas) {
    if (l.id === lineaId || String(l.productoId) !== String(productoId)) continue;
    for (const s of l.sabores ?? []) usadas[s.saborId] = (usadas[s.saborId] ?? 0) + s.cantidad;
  }
  return Object.entries(info.sabores ?? {}).map(([id, s]) => ({
    id,
    nombre: s.nombre,
    disponible: s.disponible,
    quedan: s.quedan === null ? null : Math.max(0, s.quedan - (usadas[id] ?? 0)),
  }));
}

/** Cuántas mezclas de `unidadesPorMezcla` unidades caben para esta línea; null sin límite. */
export function mezclasDisponibles(info: InfoStock, lineas: LineaCarrito[], productoId: string, unidadesPorMezcla: number, lineaId?: string): number | null {
  return maximoMezclas(saboresParaLinea(info, lineas, productoId, lineaId), unidadesPorMezcla);
}

/** Líneas de mezcla cuyas unidades elegidas no suman lo que indica su tamaño × cantidad. */
export function lineasSaborIncompletas(lineas: LineaCarrito[]): LineaCarrito[] {
  return lineas.filter((l) => {
    if (l.unidadesPorMezcla === undefined) return false;
    const elegidas = (l.sabores ?? []).reduce((acc, s) => acc + s.cantidad, 0);
    return elegidas !== l.unidadesPorMezcla * l.cantidad;
  });
}

/** Texto de la mezcla de una línea: «2 Fresa · 3 Oreo · 1 Manjar». */
export function textoSabores(linea: LineaCarrito): string {
  return (linea.sabores ?? []).map((s) => `${s.cantidad} ${s.nombre ?? 'sabor'}`).join(' · ');
}

/** Mensaje junto a una línea cuyo sabor se agotó o bajó (409 o exceso). */
export function mensajeSaborQuedan(quedan: number, saborNombre: string): string {
  return quedan <= 0 ? `Ya no quedan ${saborNombre}` : `Solo quedan ${quedan} de ${saborNombre}`;
}

/** Texto discreto de la carta: «Quedan N» hasta el umbral y «¡Última unidad!» con 1. Null en el resto. */
export function etiquetaQuedan(info: InfoStock): string | null {
  if (!info.controlaStock || info.quedan === null || info.quedan <= 0 || info.quedan > UMBRAL_QUEDAN) return null;
  return info.quedan === 1 ? '¡Última unidad!' : `Quedan ${info.quedan}`;
}

/** Unidades del producto en todas sus líneas del carrito (varias líneas comparten el saldo). */
export function unidadesEnCarrito(lineas: LineaCarrito[], productoId: string): number {
  return lineas.reduce((acc, l) => (String(l.productoId) === String(productoId) ? acc + l.cantidad : acc), 0);
}

/** Cuántas unidades más se pueden agregar; null si el producto no tiene límite. */
export function topeAgregable(info: InfoStock | undefined, enCarrito: number): number | null {
  if (!info || !info.controlaStock || info.quedan === null) return null;
  return Math.max(0, info.quedan - enCarrito);
}

/** Productos del carrito cuya suma supera lo que queda (el saldo cambió desde que se agregaron). */
export function excesosDeStock(lineas: LineaCarrito[], inventario: InventarioCarta): ExcesoStock[] {
  const salida: ExcesoStock[] = [];
  const vistos = new Set<string>();
  for (const l of lineas) {
    const id = String(l.productoId);
    const info = inventario[id];
    if (!info || vistos.has(id)) continue;
    vistos.add(id);
    if (info.sabores) {
      // con sabores, el tope es por sabor: cada sabor que pasa de lo que queda es un exceso
      const usadas = saboresEnCarrito(lineas, id);
      for (const [saborId, pedidas] of Object.entries(usadas)) {
        const sabor = info.sabores[saborId];
        if (sabor && sabor.quedan !== null && pedidas > sabor.quedan) {
          salida.push({ productoId: id, nombre: l.nombre, pedidas, quedan: sabor.quedan, saborId, saborNombre: sabor.nombre });
        }
      }
      continue;
    }
    if (!info.controlaStock || info.quedan === null) continue;
    const pedidas = unidadesEnCarrito(lineas, id);
    if (pedidas > info.quedan) salida.push({ productoId: id, nombre: l.nombre, pedidas, quedan: info.quedan });
  }
  return salida;
}

/** Recorta las líneas de un producto para que sumen como mucho `maximo`, quitando desde la última; las de 0 salen. */
export function recortarLineasProducto(lineas: LineaCarrito[], productoId: string, maximo: number): LineaCarrito[] {
  let restan = Math.max(0, maximo);
  const nuevas: LineaCarrito[] = [];
  for (const l of lineas) {
    if (String(l.productoId) !== String(productoId)) {
      nuevas.push(l);
      continue;
    }
    const cantidad = Math.min(l.cantidad, restan);
    restan -= cantidad;
    if (cantidad === 0) continue;
    if (cantidad === l.cantidad) {
      nuevas.push(l);
      continue;
    }
    nuevas.push({
      ...l,
      cantidad,
      subtotal: Number((l.precioUnitario * cantidad).toFixed(2)),
      unidades: l.unidades?.slice(0, cantidad),
    });
  }
  return nuevas;
}

/** Lee el 409 STOCK_INSUFICIENTE del servidor ({ codigo, mensaje, productoId, quedan }). */
export function stockInsuficienteDe(err: unknown): { productoId: string | null; quedan: number; mensaje: string } | null {
  if (!(err instanceof ErrorApi) || err.codigo !== 'STOCK_INSUFICIENTE') return null;
  const d = (err.detalles ?? {}) as { productoId?: unknown; quedan?: unknown };
  const quedan = Number(d.quedan);
  return {
    productoId: d.productoId != null ? String(d.productoId) : null,
    quedan: Number.isFinite(quedan) ? Math.max(0, Math.floor(quedan)) : 0,
    mensaje: err.message,
  };
}

/** Sabor rechazado por el servidor: 409 SABOR_AGOTADO o STOCK_INSUFICIENTE con saborId. */
export function saborRechazadoDe(err: unknown): { productoId: string; saborId: string; saborNombre: string; quedan: number } | null {
  if (!(err instanceof ErrorApi) || (err.codigo !== 'SABOR_AGOTADO' && err.codigo !== 'STOCK_INSUFICIENTE')) return null;
  const d = (err.detalles ?? {}) as { productoId?: unknown; saborId?: unknown; saborNombre?: unknown; quedan?: unknown };
  if (d.saborId == null) return null;
  const quedan = err.codigo === 'SABOR_AGOTADO' ? 0 : Number(d.quedan);
  return {
    productoId: String(d.productoId ?? ''),
    saborId: String(d.saborId),
    saborNombre: typeof d.saborNombre === 'string' && d.saborNombre ? d.saborNombre : 'este sabor',
    quedan: Number.isFinite(quedan) ? Math.max(0, Math.floor(quedan)) : 0,
  };
}

/** Al bajar la cantidad de una mezcla, quita sabores desde el último hasta cuadrar con el nuevo total. */
export function recortarSaboresAlTotal(sabores: SaborLinea[], total: number): SaborLinea[] {
  let restan = Math.max(0, total);
  const salida: SaborLinea[] = [];
  for (const s of sabores) {
    const cantidad = Math.min(s.cantidad, restan);
    restan -= cantidad;
    if (cantidad > 0) salida.push({ ...s, cantidad });
  }
  return salida;
}
