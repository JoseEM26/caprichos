import { detalleLinea, textoSabores, type LineaComanda } from '../cocina/cocinaTipos';
import type { LineaPedido } from './pedidosApi';

/** Colores del detalle en Caja (los mismos de Despacho, explícitos y con contraste AA sobre fondo claro). */
export const COLOR_DETALLE = { nombre: '#0B2C3E', suave: '#2C4C5D', oxido: '#B2500F' } as const;

export interface ItemCaja {
  id: string;
  cantidad: number;
  nombre: string;
  /** «Grande 16 oz · Leche entera · Para Luis» (misma función que Despacho). */
  detalle: string;
  /** «1 Fresa · 1 Manjar» o vacío. */
  sabores: string;
  nota: string;
  /** Piezas del combo, ya con su detalle. */
  partes: ItemCaja[];
}

/** Línea del pedido (API de Caja) con la forma que usa Despacho, para reutilizar sus reglas. */
function comanda(l: LineaPedido): LineaComanda {
  return {
    id: String(l.id),
    nombre: l.nombre,
    cantidad: l.cantidad,
    tamano: l.tamano,
    sabor: l.sabor,
    sabores: (l.sabores ?? []).map((s) => ({ nombre: s.nombre || s.sabor_nombre || '', cantidad: s.cantidad })).filter((s) => s.nombre),
    opciones: (l.opcionesElegidas || l.opciones || []).map((o) => ({ nombre: o.opcion_nombre || o.nombre || '' })).filter((o) => o.nombre),
    personas: l.nombres_persona ?? [],
    nota: l.nota,
  };
}

function item(l: LineaPedido, todas: LineaPedido[]): ItemCaja {
  const c = comanda(l);
  return {
    id: c.id,
    cantidad: l.cantidad,
    nombre: l.nombre,
    detalle: detalleLinea(c).join(' · '),
    sabores: textoSabores(c) ?? '',
    nota: (l.nota ?? '').trim(),
    partes: l.id == null ? [] : todas.filter((h) => h.linea_combo_id != null && String(h.linea_combo_id) === String(l.id)).map((h) => item(h, todas)),
  };
}

/** Líneas de nivel superior (las piezas de combo cuelgan de su madre) con su detalle. */
export const itemsCaja = (lineas: LineaPedido[] = []): ItemCaja[] => lineas.filter((l) => l.linea_combo_id == null).map((l) => item(l, lineas));

/** Texto de una línea en una sola fila: «Grande 16 oz · Leche entera · 1 Fresa». */
export const textoDetalle = (i: ItemCaja): string => [i.detalle, i.sabores].filter(Boolean).join(' · ');

export const MAX_PRODUCTOS_TARJETA = 4;

/** Contraste WCAG entre dos colores #RRGGBB. */
export function contraste(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
