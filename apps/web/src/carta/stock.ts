import { ErrorApi } from '../comun/api';
import type { LineaCarrito, ProductoCarta } from './tipos';

/** Hasta cuántas unidades se muestra la etiqueta «Quedan N». Ajustable. */
export const UMBRAL_QUEDAN = 5;

/** Cada cuánto, como mínimo, la carta vuelve a pedirse al abrir el carrito o el checkout. */
export const INTERVALO_REFRESCO_STOCK_MS = 20_000;

export interface InfoStock {
  controlaStock: boolean;
  /** null: sin límite (no controlado o sin conteo de apertura hoy). */
  quedan: number | null;
  disponible: boolean;
}

/** Stock por productoId, tomado de la última carta cargada. */
export type InventarioCarta = Record<string, InfoStock>;

export interface ExcesoStock {
  productoId: string;
  nombre: string;
  pedidas: number;
  quedan: number;
}

export function infoStockDe(p: Pick<ProductoCarta, 'controlaStock' | 'quedan' | 'disponible'>): InfoStock {
  const controla = p.controlaStock === true;
  return {
    controlaStock: controla,
    quedan: controla && typeof p.quedan === 'number' ? p.quedan : null,
    disponible: p.disponible,
  };
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
  const vistos = new Map<string, ExcesoStock>();
  for (const l of lineas) {
    const id = String(l.productoId);
    const info = inventario[id];
    if (!info || !info.controlaStock || info.quedan === null) continue;
    const pedidas = unidadesEnCarrito(lineas, id);
    if (pedidas > info.quedan && !vistos.has(id)) {
      vistos.set(id, { productoId: id, nombre: l.nombre, pedidas, quedan: info.quedan });
    }
  }
  return [...vistos.values()];
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
