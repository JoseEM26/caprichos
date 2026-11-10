import type { Pedido } from './pedidosApi';
import { MEDIOS_PLAN, nombreMedio } from './planPago';

/** Medios del filtro «Medio de pago» (mismo orden y nombres que el plan de pago). */
export const MEDIOS_FILTRO = MEDIOS_PLAN.map((m) => ({ id: m.id as string, n: m.nombre }));

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
  return medios.some((m) => propios.includes(norm(m)));
}

/** Reparte el total de un pedido entre sus medios: con plan dividido usa sus montos; si no, todo al único medio (o al primero). */
export function montosPorMedio(p: Pedido): Record<string, number> {
  const out: Record<string, number> = {};
  const total = Number(p.total || 0);
  if (p.planPago?.length) {
    for (const x of p.planPago) out[norm(x.medio)] = (out[norm(x.medio)] ?? 0) + Number(x.monto || 0);
    return out;
  }
  const medios = mediosDePedido(p);
  if (medios.length) out[medios[0]] = total;
  return out;
}

export { nombreMedio };
