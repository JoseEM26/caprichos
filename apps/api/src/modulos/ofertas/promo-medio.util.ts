import { ConflictException } from '@nestjs/common';
import { ofertaIncluyeMedios } from './ofertas.util';
import { totalPedido } from '../../comun/total-pedido';

/**
 * Descuentos del pedido que dependen del medio de pago (promo por medio y cupón por medio) y que se pierden
 * porque se cobra con un medio que no es de su lista: se quitan y el total sube.
 */
export interface ItemQuitaMedio {
  tipo: 'OFERTA' | 'CUPON';
  id: string;
  nombre: string;
  monto: number;
}

export interface QuitaPromoMedio {
  /** Nombres separados por « y » (para el aviso). */
  nombre: string;
  /** Lo que se había descontado y ahora se devuelve al total. */
  descuento: number;
  totalAnterior: number;
  totalNuevo: number;
  items: ItemQuitaMedio[];
}

type DbOferta = { oferta: { findUnique: (a: any) => Promise<any> }; cupon?: { findUnique: (a: any) => Promise<any> } };

const dosDec = (n: number) => Math.round(n * 100) / 100;

/** ¿Hay que quitar descuentos (promo y/o cupón por medio) por el medio de cobro? null = nada que quitar. */
export async function evaluarQuitaPromoMedio(
  db: DbOferta,
  pedido: {
    oferta_id?: bigint | null;
    cupon_id?: bigint | null;
    descuento_detalle?: unknown;
    subtotal?: unknown;
    descuento?: unknown;
    envio?: unknown;
    puntos_canjeados?: unknown;
    total?: unknown;
  },
  mediosCobro: Array<string | null | undefined>,
): Promise<QuitaPromoMedio | null> {
  const medios = mediosCobro.map((m) => String(m ?? '').trim().toUpperCase()).filter(Boolean);
  if (medios.length === 0) return null;
  const detalle = Array.isArray(pedido.descuento_detalle) ? (pedido.descuento_detalle as any[]) : [];
  const items: ItemQuitaMedio[] = [];

  if (pedido.oferta_id != null) {
    const oferta = await db.oferta.findUnique({ where: { id: pedido.oferta_id }, select: { id: true, nombre: true, medios_pago: true } });
    const cond: string[] = oferta?.medios_pago ?? [];
    if (oferta && cond.length > 0 && !ofertaIncluyeMedios(cond, medios)) {
      const it = detalle.find((d) => String(d?.id) === String(oferta.id) && (d?.tipo === 'DESCUENTO' || d?.tipo === 'PROMO'));
      const monto = dosDec(Number(it?.montoDescontado ?? 0));
      if (monto > 0) items.push({ tipo: 'OFERTA', id: String(oferta.id), nombre: oferta.nombre, monto });
    }
  }
  if (pedido.cupon_id != null && db.cupon) {
    const cupon = await db.cupon.findUnique({ where: { id: pedido.cupon_id }, select: { id: true, codigo_base: true, medios_pago: true } });
    const cond: string[] = cupon?.medios_pago ?? [];
    if (cupon && cond.length > 0 && !ofertaIncluyeMedios(cond, medios)) {
      const it = detalle.find((d) => d?.tipo === 'CUPON' && String(d?.id) === String(cupon.id));
      const monto = dosDec(Number(it?.montoDescontado ?? 0));
      if (monto > 0) items.push({ tipo: 'CUPON', id: String(cupon.id), nombre: `Cupón ${cupon.codigo_base}`, monto });
    }
  }
  if (items.length === 0) return null;

  const descuento = dosDec(items.reduce((a, i) => a + i.monto, 0));
  const totalAnterior = dosDec(Number(pedido.total ?? 0));
  const descuentoNuevo = Math.max(0, dosDec(Number(pedido.descuento ?? 0) - descuento));
  const totalNuevo = totalPedido({ subtotal: pedido.subtotal, descuento: descuentoNuevo, envio: pedido.envio, puntosCanjeados: pedido.puntos_canjeados });
  return { nombre: items.map((i) => i.nombre).join(' y '), descuento, totalAnterior, totalNuevo, items };
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
 * Aplica la quita dentro de la transacción: los descuentos salen del pedido (columna, detalle, promo y cupón enlazados),
 * el total sube, los usos se devuelven (el cupón emitido vuelve a VIGENTE) y el plan de pago anterior (armado con el total viejo) se borra.
 * Devuelve los campos nuevos para que quien llama siga con el pedido actualizado.
 */
export async function aplicarQuitaPromoMedio(
  tx: any,
  pedido: { id: bigint; descuento?: unknown; descuento_detalle?: unknown; cupon_emitido_id?: bigint | null },
  q: QuitaPromoMedio,
) {
  const quitados = new Set(q.items.map((i) => `${i.tipo === 'CUPON' ? 'CUPON' : 'OFERTA'}:${i.id}`));
  const detalle = (Array.isArray(pedido.descuento_detalle) ? (pedido.descuento_detalle as any[]) : []).filter(
    (d) => !(quitados.has(`OFERTA:${d?.id}`) && d?.tipo !== 'CUPON') && !(quitados.has(`CUPON:${d?.id}`) && d?.tipo === 'CUPON'),
  );
  const descuento = Math.max(0, dosDec(Number(pedido.descuento ?? 0) - q.descuento));
  const data: Record<string, unknown> = { descuento, total: q.totalNuevo, descuento_detalle: detalle };
  const campos: Record<string, unknown> = { descuento, total: q.totalNuevo, descuento_detalle: detalle };
  for (const it of q.items) {
    if (it.tipo === 'OFERTA') {
      data.oferta_id = null;
      campos.oferta_id = null;
      await tx.oferta.update({ where: { id: BigInt(it.id) }, data: { usos_actuales: { decrement: 1 } } }).catch(() => undefined);
    } else {
      data.cupon_id = null;
      data.cupon_emitido_id = null;
      campos.cupon_id = null;
      campos.cupon_emitido_id = null;
      if (pedido.cupon_emitido_id != null) {
        await tx.cuponEmitido?.update?.({ where: { id: pedido.cupon_emitido_id }, data: { estado: 'VIGENTE', canjeado_en: null, pedido_canje_id: null } });
      } else {
        await tx.cupon?.update?.({ where: { id: BigInt(it.id) }, data: { usos_actuales: { decrement: 1 } } });
        await tx.cuponCanjeCompartido?.deleteMany?.({ where: { cupon_id: BigInt(it.id), pedido_id: pedido.id } });
      }
    }
  }
  await tx.pedido.update({ where: { id: pedido.id }, data });
  await tx.pedidoPagoPlan?.deleteMany?.({ where: { pedido_id: pedido.id } });
  return campos;
}
