import { ConflictException } from '@nestjs/common';
import { ofertaIncluyeMedios } from './ofertas.util';
import { totalPedido } from '../../comun/total-pedido';

/**
 * Promo por medio de pago («10 % pagando con Yape») cuyo descuento ya está en el pedido pero el medio con que
 * se cobra al final NO es de la lista: el descuento se quita y el total sube.
 */
export interface QuitaPromoMedio {
  ofertaId: string;
  nombre: string;
  /** Lo que se había descontado y ahora se devuelve al total. */
  descuento: number;
  totalAnterior: number;
  totalNuevo: number;
}

type DbOferta = { oferta: { findUnique: (a: any) => Promise<any> } };

const dosDec = (n: number) => Math.round(n * 100) / 100;

/** ¿Hay que quitar el descuento de la promo del pedido por el medio de cobro? null = nada que quitar. */
export async function evaluarQuitaPromoMedio(
  db: DbOferta,
  pedido: { oferta_id?: bigint | null; descuento_detalle?: unknown; subtotal?: unknown; descuento?: unknown; envio?: unknown; puntos_canjeados?: unknown; total?: unknown },
  mediosCobro: Array<string | null | undefined>,
): Promise<QuitaPromoMedio | null> {
  if (pedido.oferta_id == null) return null;
  const oferta = await db.oferta.findUnique({ where: { id: pedido.oferta_id }, select: { id: true, nombre: true, medios_pago: true } });
  const condicion: string[] = oferta?.medios_pago ?? [];
  if (!oferta || condicion.length === 0) return null;
  const medios = mediosCobro.map((m) => String(m ?? '').trim().toUpperCase()).filter(Boolean);
  if (medios.length === 0 || ofertaIncluyeMedios(condicion, medios)) return null;
  const detalle = Array.isArray(pedido.descuento_detalle) ? (pedido.descuento_detalle as any[]) : [];
  const item = detalle.find((d) => String(d?.id) === String(oferta.id) && (d?.tipo === 'DESCUENTO' || d?.tipo === 'PROMO'));
  const monto = dosDec(Number(item?.montoDescontado ?? 0));
  if (monto <= 0) return null;
  const totalAnterior = dosDec(Number(pedido.total ?? 0));
  const descuentoNuevo = Math.max(0, dosDec(Number(pedido.descuento ?? 0) - monto));
  const totalNuevo = totalPedido({ subtotal: pedido.subtotal, descuento: descuentoNuevo, envio: pedido.envio, puntosCanjeados: pedido.puntos_canjeados });
  return { ofertaId: String(oferta.id), nombre: oferta.nombre, descuento: monto, totalAnterior, totalNuevo };
}

/** Error 409 que ve Caja o el mozo antes de confirmar: «Sin descuento X: total S/ Y». */
export function errorPromoSeQuita(q: QuitaPromoMedio): ConflictException {
  return new ConflictException({
    codigo: 'PROMO_SE_QUITA',
    mensaje: `Sin descuento ${q.nombre}: total S/ ${q.totalNuevo.toFixed(2)}`,
    promo: q.nombre,
    descuento: q.descuento,
    totalAnterior: q.totalAnterior,
    totalNuevo: q.totalNuevo,
  });
}

/**
 * Aplica la quita dentro de la transacción: el descuento sale del pedido (columna, detalle y oferta enlazada),
 * el total sube, el uso de la promo se devuelve y el plan de pago anterior (armado con el total viejo) se borra.
 * Devuelve los campos nuevos para que quien llama siga con el pedido actualizado.
 */
export async function aplicarQuitaPromoMedio(tx: any, pedido: { id: bigint; descuento?: unknown; descuento_detalle?: unknown }, q: QuitaPromoMedio) {
  const detalle = (Array.isArray(pedido.descuento_detalle) ? (pedido.descuento_detalle as any[]) : []).filter((d) => String(d?.id) !== q.ofertaId);
  const descuento = Math.max(0, dosDec(Number(pedido.descuento ?? 0) - q.descuento));
  await tx.pedido.update({
    where: { id: pedido.id },
    data: { descuento, total: q.totalNuevo, oferta_id: null, descuento_detalle: detalle },
  });
  await tx.oferta.update({ where: { id: BigInt(q.ofertaId) }, data: { usos_actuales: { decrement: 1 } } }).catch(() => undefined);
  await tx.pedidoPagoPlan?.deleteMany?.({ where: { pedido_id: pedido.id } });
  return { descuento, total: q.totalNuevo, oferta_id: null, descuento_detalle: detalle };
}
