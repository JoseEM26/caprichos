import { BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { montoACobrar } from '../../comun/monto-a-cobrar';
import { obtenerFechaHoraLima } from '../local/local.util';
import { aCentimos, bloquearCaja, enPesos, errorCajaAnteriorAbierta, esCentimosValidos } from '../caja/caja.calculo';

/** Medios de un adelanto: los que no llevan voucher (los digitales se cobran completos con su captura). */
export const MEDIOS_ADELANTO = ['EFECTIVO', 'TARJETA'] as const;

export interface AdelantoEntrada {
  medio: string;
  monto: number;
  /** Efectivo que entregó el cliente (para calcular el vuelto). */
  pagaCon?: number;
}

/**
 * Registra un adelanto de un pedido PROGRAMADO en la caja de HOY (debe estar abierta): ese dinero entra al cierre
 * de hoy aunque el pedido se cobre otro día. El adelanto nunca cubre todo el pedido (eso es un cobro normal).
 * El plan de pago declarado se borra: el saldo se cobra con los medios reales del día de pago.
 */
export async function registrarAdelantoTx(tx: Prisma.TransactionClient, pedidoId: bigint, entrada: AdelantoEntrada, porPartyId: bigint) {
  const medio = String(entrada.medio ?? '').toUpperCase();
  if (!(MEDIOS_ADELANTO as readonly string[]).includes(medio)) {
    throw new BadRequestException({ codigo: 'ADELANTO_MEDIO_INVALIDO', mensaje: 'El adelanto se recibe en efectivo o con tarjeta; el pago digital se cobra completo con su captura' });
  }
  const monto = Number(entrada.monto);
  if (!Number.isFinite(monto) || monto <= 0 || !esCentimosValidos(monto)) {
    throw new BadRequestException({ codigo: 'ADELANTO_MONTO_INVALIDO', mensaje: 'El adelanto debe ser mayor a 0 y con máximo dos decimales' });
  }
  const { fechaIso } = obtenerFechaHoraLima();
  const cajaHoy = await tx.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
  const caja = cajaHoy ? await bloquearCaja(tx, cajaHoy.id) : null;
  if (!caja || caja.estado !== 'ABIERTA') {
    throw (
      (await errorCajaAnteriorAbierta(tx)) ??
      new HttpException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para recibir el adelanto' }, HttpStatus.CONFLICT)
    );
  }
  const pedido = await tx.pedido.findUnique({ where: { id: pedidoId } });
  if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
  if (pedido.estado !== 'PROGRAMADO') {
    throw new ConflictException({ codigo: 'ADELANTO_SOLO_PROGRAMADO', mensaje: 'Solo un pedido programado recibe adelantos; los demás se cobran completos' });
  }
  const saldo = aCentimos(montoACobrar(pedido));
  if (aCentimos(monto) >= saldo) {
    throw new BadRequestException({
      codigo: 'ADELANTO_CUBRE_TODO',
      mensaje: `El adelanto debe ser menor al saldo (S/ ${enPesos(saldo).toFixed(2)}); para pagar todo usa Cobrar`,
    });
  }
  let recibido: number | null = null;
  let vuelto: number | null = null;
  if (medio === 'EFECTIVO' && entrada.pagaCon != null) {
    recibido = Number(entrada.pagaCon);
    if (!Number.isFinite(recibido) || aCentimos(recibido) < aCentimos(monto)) {
      throw new BadRequestException({ codigo: 'EFECTIVO_INSUFICIENTE', mensaje: 'El efectivo recibido es menor al adelanto' });
    }
    vuelto = enPesos(aCentimos(recibido) - aCentimos(monto));
  }
  const adelanto = await tx.pedidoAdelanto.create({
    data: { pedido_id: pedidoId, caja_id: caja.id, medio, monto: new Prisma.Decimal(monto), recibido, vuelto, por_party_id: porPartyId },
  });
  await tx.pedido.update({ where: { id: pedidoId }, data: { adelanto_total: { increment: new Prisma.Decimal(monto) } } });
  await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: pedidoId } });
  return adelanto;
}

/** Anula un adelanto (devolución al cliente). Solo si su caja sigue abierta: si ya cerró, el cierre no se reabre. */
export async function anularAdelantoTx(tx: Prisma.TransactionClient, adelantoId: bigint, motivo: string, porPartyId: bigint) {
  const previo = await tx.pedidoAdelanto.findUnique({ where: { id: adelantoId } });
  if (!previo) throw new NotFoundException({ codigo: 'ADELANTO_NO_ENCONTRADO', mensaje: 'El adelanto no existe' });
  const caja = await bloquearCaja(tx, previo.caja_id);
  if (previo.anulado_en) throw new ConflictException({ codigo: 'ADELANTO_YA_ANULADO', mensaje: 'El adelanto ya estaba anulado' });
  if (!caja || caja.estado !== 'ABIERTA') {
    throw new ConflictException({ codigo: 'ADELANTO_CAJA_CERRADA', mensaje: 'La caja que recibió este adelanto ya cerró: no se puede anular. Registra la devolución al cliente.' });
  }
  await tx.pedidoAdelanto.update({ where: { id: adelantoId }, data: { anulado_en: new Date(), anulado_por: porPartyId, motivo_anulacion: motivo } });
  await tx.pedido.update({ where: { id: previo.pedido_id }, data: { adelanto_total: { decrement: previo.monto } } });
  return previo;
}
