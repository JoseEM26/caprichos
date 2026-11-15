import { montoPorCobrar, type Pedido } from './pedidosApi';
import { MEDIOS_PLAN, nombreMedio } from './planPago';

/** Medios del filtro «Medio de pago» (mismo orden y nombres que el plan de pago). */
export const MEDIOS_FILTRO = [
  ...MEDIOS_PLAN.map((m) => ({ id: m.id as string, n: m.nombre })),
  // No es un medio sino un origen: pedidos pagados por la pasarela (Culqi), que no llegan al Yape ni al POS del local
  { id: 'CULQI', n: 'Pagado por Culqi' },
];

const norm = (m: unknown) => String(m ?? '').trim().toUpperCase();

/**
 * Medios con los que se pagó (o se va a pagar) un pedido, sin repetir. Orden de prioridad: lo que manda el servidor
 * (`mediosPago`), el plan de pago dividido, el medio del cobro por mozo y, si ya está pagado, el medio del pedido.
 */
export function mediosDePedido(p: Pedido): string[] {
  let lista: string[] = [];
  if (Array.isArray(p.mediosPago) && p.mediosPago.length) lista = p.mediosPago.map(norm);
  else if (p.planPago?.length) lista = p.planPago.map((x) => norm(x.medio));
  else if (p.cobroMozo?.medio) lista = p.cobroMozo.medio.split('+').map(norm);
  else if (norm(p.pago_estado) === 'PAGADO' && p.pago_metodo) lista = p.pago_metodo.split('+').map(norm);
  return [...new Set(lista.filter(Boolean))];
}

/** ¿Pasa el filtro de medios? Vacío = todos; si no, basta que el pedido tenga alguno de los elegidos. */
export function enMedios(p: Pedido, medios: readonly string[]): boolean {
  if (medios.length === 0) return true;
  const propios = mediosDePedido(p);
  return medios.some((m) => (norm(m) === 'CULQI' ? pagadoPorCulqi(p) : propios.includes(norm(m))));
}

/** ¿El pedido se pagó por la pasarela (cobro con origen Culqi o pago en línea aprobado)? */
export function pagadoPorCulqi(p: Pedido): boolean {
  return (p.mediosCulqi?.length ?? 0) > 0 || !!p.pagoOnline;
}

/** ¿Este medio del pedido llegó por Culqi? (Yape/Tarjeta de un cobro con origen Culqi). */
export function medioPorCulqi(p: Pedido, medio: string): boolean {
  return (p.mediosCulqi ?? []).map(norm).includes(norm(medio));
}

/** Reparte el total de un pedido entre sus medios: con plan dividido usa sus montos; si no, todo al único medio (o al primero). */
export function montosPorMedio(p: Pedido): Record<string, number> {
  const out: Record<string, number> = {};
  const total = montoPorCobrar(p);
  if (p.planPago?.length) {
    for (const x of p.planPago) out[norm(x.medio)] = (out[norm(x.medio)] ?? 0) + Number(x.monto || 0);
    return out;
  }
  const medios = mediosDePedido(p);
  if (medios.length) out[medios[0]] = total;
  return out;
}

export { nombreMedio };
