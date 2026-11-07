import { avisoStock, umbralesAvisoStock } from '@caprichos/compartido';

export const TEXTO_AVISO_STOCK_DEFECTO = '🍩 {aviso}';

/** Ajusta la plantilla (clave chatbot_texto_aviso_stock) con el texto del aviso; sin {aviso} se agrega al final. */
function conPlantilla(aviso: string, plantilla?: string | null): string {
  const base = plantilla?.trim() || TEXTO_AVISO_STOCK_DEFECTO;
  return base.includes('{aviso}') ? base.replace(/\{aviso\}/g, aviso) : `${base} ${aviso}`;
}

interface ContextoAviso {
  datosLocalPublicos?: any;
  textosPersonalizados?: Record<string, string>;
}

export function umbralesDe(contexto: ContextoAviso) {
  return umbralesAvisoStock(contexto.datosLocalPublicos?.avisoStock?.quedan, contexto.datosLocalPublicos?.avisoStock?.ultimas);
}

/**
 * Línea «🍩 ¡Quedan solo 3, ya se acaban!» para un producto de la carta del bot (con `quedan` numérico = stock
 * controlado). Null si no controla, está agotado o queda fuera del rango de aviso configurado.
 * `conNombre` antepone el producto (resumen del pedido, donde hay varias líneas).
 */
export function lineaAvisoStock(prod: any, contexto: ContextoAviso, conNombre = false): string | null {
  if (!prod || typeof prod.quedan !== 'number') return null;
  const a = avisoStock({ controlaStock: true, quedan: prod.quedan, nombre: prod.nombre }, umbralesDe(contexto));
  if (!a) return null;
  return conPlantilla(conNombre ? `${prod.nombre}: ${a.texto}` : a.texto, contexto.textosPersonalizados?.chatbot_texto_aviso_stock);
}

/**
 * Avisos del resumen del pedido: solo los productos cuyo saldo entra en el rango de aviso Y que el pedido deja
 * en 0 o 1 unidad (usa todo o casi todo el saldo). `unidadesDe` convierte una línea en unidades (1/2 docena = 6).
 */
export function lineasAvisoResumen(
  items: { productoId: string; cantidad: number; tamanoId?: string }[],
  productoDe: (productoId: string) => any,
  unidadesDe: (prod: any, tamanoId?: string) => number,
  contexto: ContextoAviso,
): string[] {
  const pedidas = new Map<string, number>();
  for (const i of items) {
    const prod = productoDe(i.productoId);
    pedidas.set(String(i.productoId), (pedidas.get(String(i.productoId)) ?? 0) + i.cantidad * unidadesDe(prod, i.tamanoId));
  }
  const lineas: string[] = [];
  for (const [id, unidades] of pedidas) {
    const prod = productoDe(id);
    if (typeof prod?.quedan !== 'number' || prod.quedan - unidades > 1) continue;
    const l = lineaAvisoStock(prod, contexto, true);
    if (l) lineas.push(l);
  }
  return lineas;
}
