/**
 * Entrega de pedidos listos (funciones puras): cuándo un pedido está de verdad listo, qué pasos hace Capri
 * y qué lleva en la bandeja. Una misma entrega no se repite (llave por id de pedido).
 */
export type PasoEntrega =
  | 'ir_cocina' | 'tomar_bandeja' | 'ir_mesa' | 'entregar' | 'agradecer'
  | 'tomar_bolsa' | 'ir_mostrador'
  | 'tomar_caja' | 'ir_entrada' | 'entregar_repartidor' | 'repartidor_se_va' | 'volver';

export interface PedidoEntrega {
  id: string;
  modalidad: string;
  estado?: string;
  areas: Array<{ estado: string }>;
}

/** Listo de verdad: el pedido figura LISTO o todas sus áreas terminaron. */
export const estaListo = (p: Pick<PedidoEntrega, 'estado' | 'areas'>): boolean =>
  p.estado === 'LISTO' || (p.areas.length > 0 && p.areas.every((a) => a.estado === 'LISTA'));

/**
 * Pasos de la entrega de un pedido listo. De mesa: cocina, bandeja, mesa, dejar los productos, agradecer.
 * Para llevar: cocina, bolsa, mostrador, agradecer. Delivery: cocina, caja, entrada, se la da al repartidor, él se va y ella vuelve. Vacío si no está listo o ya se entregó (queda anotado en `hechas`).
 */
export function planEntrega(p: PedidoEntrega, hechas: Set<string>): PasoEntrega[] {
  if (!estaListo(p) || hechas.has(p.id)) return [];
  hechas.add(p.id);
  if (p.modalidad === 'MESA') return ['ir_cocina', 'tomar_bandeja', 'ir_mesa', 'entregar', 'agradecer'];
  if (p.modalidad === 'DELIVERY') return ['ir_cocina', 'tomar_caja', 'ir_entrada', 'entregar_repartidor', 'repartidor_se_va', 'volver'];
  return ['ir_cocina', 'tomar_bolsa', 'ir_mostrador', 'agradecer'];
}

export const TOPE_BANDEJA = 6;

/** Qué se ve en la bandeja y en la mesa: al menos un vaso por bebida y un plato por el resto de productos (mínimo una cosa, con tope). */
export function productosBandeja(bebidas: number | null | undefined, productos: number | null | undefined): { vasos: number; platos: number } {
  const b = Math.max(0, bebidas ?? 0), total = Math.max(0, productos ?? 0);
  const vasos = Math.min(TOPE_BANDEJA, b);
  const platos = Math.min(TOPE_BANDEJA - vasos, Math.max(0, total - b));
  return vasos + platos === 0 ? { vasos: 0, platos: 1 } : { vasos, platos };
}

export const UMBRAL_ESPERA = 15;

/**
 * Qué dice Capri al pasar por una mesa según el estado REAL de su pedido. Si ya está listo no dice nada de «ya casi sale»:
 * lo va a entregar. Solo habla de la espera si el pedido de verdad sigue en cocina.
 */
export function frasePaseo(s: { listo: boolean; enCocina: boolean; minutos: number; comiendo: boolean }): 'listo' | 'espera' | 'cocina' | 'comiendo' | null {
  if (s.comiendo) return 'comiendo';
  if (s.listo) return 'listo';
  if (!s.enCocina) return null;
  return s.minutos >= UMBRAL_ESPERA ? 'espera' : 'cocina';
}
