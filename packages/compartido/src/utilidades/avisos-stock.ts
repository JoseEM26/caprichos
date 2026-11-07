/** Avisos de «se está acabando» del stock de productos terminados: los usan la carta, el admin y el bot. */

export interface UmbralesAvisoStock {
  /** Avisa «Quedan N» desde esta cantidad (0 = sin aviso). */
  quedan: number;
  /** Franja «¡Últimas!» desde esta cantidad (0 = sin franja). Nunca mayor que `quedan`. */
  ultimas: number;
}

export const UMBRALES_AVISO_STOCK_DEFECTO: UmbralesAvisoStock = { quedan: 5, ultimas: 3 };
export const AVISO_STOCK_MAX = 20;

export interface AvisoStock {
  texto: string;
  /** franja = «¡Última/s!» y «ya se acaban» (llamativo); quedan = «Quedan N» discreto. */
  tipo: 'franja' | 'quedan';
}

function entero(v: unknown, defecto: number): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= AVISO_STOCK_MAX ? n : defecto;
}

/** Umbrales válidos: valores fuera de 0–20 o que no existan usan los de siempre; la franja nunca pasa del aviso. */
export function umbralesAvisoStock(quedan?: unknown, ultimas?: unknown): UmbralesAvisoStock {
  const q = entero(quedan, UMBRALES_AVISO_STOCK_DEFECTO.quedan);
  const u = entero(ultimas, UMBRALES_AVISO_STOCK_DEFECTO.ultimas);
  return { quedan: q, ultimas: Math.min(u, q) };
}

/**
 * «Dona»/«Donas» -> «dona» + género. Solo nombres simples de una palabra que terminan en a, o, as, os;
 * cualquier otro nombre devuelve null y el aviso dice «unidad».
 */
export function unidadNatural(nombre: string | null | undefined): { palabra: string; femenino: boolean } | null {
  const n = (nombre ?? '').trim().toLowerCase();
  if (!/^[a-záéíóúñ]{4,}$/.test(n)) return null;
  if (n.endsWith('as') || n.endsWith('os')) return { palabra: n.slice(0, -1), femenino: n.endsWith('as') };
  if (n.endsWith('a') || n.endsWith('o')) return { palabra: n, femenino: n.endsWith('a') };
  return null;
}

/** Aviso de un producto (total de unidades). Null: sin control, sin conteo, agotado o fuera del rango de aviso. */
export function avisoStock(
  producto: { controlaStock?: boolean; quedan: number | null | undefined; nombre?: string | null },
  umbrales: UmbralesAvisoStock = UMBRALES_AVISO_STOCK_DEFECTO,
): AvisoStock | null {
  const q = producto.quedan;
  if (producto.controlaStock === false || typeof q !== 'number' || !Number.isFinite(q) || q <= 0) return null;
  if (q <= umbrales.ultimas) {
    if (q === 1) {
      const u = unidadNatural(producto.nombre);
      return { tipo: 'franja', texto: u ? `¡${u.femenino ? 'Última' : 'Último'} ${u.palabra}!` : '¡Última unidad!' };
    }
    if (q === 2) return { tipo: 'franja', texto: '¡Últimas 2!' };
    return { tipo: 'franja', texto: `¡Quedan solo ${q}, ya se acaban!` };
  }
  if (q <= umbrales.quedan) return { tipo: 'quedan', texto: q === 1 ? 'Queda 1' : `Quedan ${q}` };
  return null;
}

/** Aviso de un sabor dentro de la ventana del producto: «Fresa: ¡última!», «Oreo: quedan 2». */
export function avisoSabor(nombre: string, quedan: number | null | undefined, umbrales: UmbralesAvisoStock = UMBRALES_AVISO_STOCK_DEFECTO): string | null {
  if (typeof quedan !== 'number' || quedan <= 0 || quedan > umbrales.quedan) return null;
  return quedan === 1 ? `${nombre}: ¡última!` : `${nombre}: quedan ${quedan}`;
}
