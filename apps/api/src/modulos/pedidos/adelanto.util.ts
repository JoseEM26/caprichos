import { BadRequestException, ConflictException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { montoACobrar } from '../../comun/monto-a-cobrar';
import { obtenerFechaHoraLima } from '../local/local.util';
import { aCentimos, bloquearCaja, enPesos, errorCajaAnteriorAbierta, esCentimosValidos } from '../caja/caja.calculo';

/** Medios de un adelanto: cualquiera; la captura (voucher) de un medio digital es opcional (se puede adjuntar, no se exige). */
export const MEDIOS_ADELANTO = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'] as const;

export interface AdelantoEntrada {
  medio: string;
  monto: number;
  /** Efectivo que entregó el cliente (para calcular el vuelto). */
  pagaCon?: number;
  /** Captura ya subida del pago digital (opcional). */
  voucherId?: string | number;
}

/**
 * Registra un adelanto de un pedido PROGRAMADO en la caja de HOY (debe estar abierta): ese dinero entra al cierre
 * de hoy aunque el pedido se cobre otro día. El adelanto nunca cubre todo el pedido (eso es un cobro normal).
 * El plan de pago declarado se borra: el saldo se cobra con los medios reales del día de pago.
 */
export async function registrarAdelantoTx(tx: Prisma.TransactionClient, pedidoId: bigint, entrada: AdelantoEntrada, porPartyId: bigint) {
  const medio = String(entrada.medio ?? '').toUpperCase();
  if (!(MEDIOS_ADELANTO as readonly string[]).includes(medio)) {
    throw new BadRequestException({ codigo: 'ADELANTO_MEDIO_INVALIDO', mensaje: 'Medio de pago no válido para el adelanto' });
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
  // Captura opcional: si viene, se enlaza al pedido (un voucher de otro pedido o reemplazado se rechaza)
  if (entrada.voucherId != null && entrada.voucherId !== '') {
    const v = await tx.voucherPago.findUnique({ where: { id: BigInt(entrada.voucherId) }, select: { id: true, pedido_id: true, reemplazado_en: true } });
    if (!v) throw new NotFoundException({ codigo: 'VOUCHER_NO_ENCONTRADO', mensaje: 'La captura indicada no existe' });
    if (v.reemplazado_en != null || (v.pedido_id !== null && v.pedido_id !== pedidoId)) {
      throw new ConflictException({ codigo: 'VOUCHER_NO_VALIDO', mensaje: 'Esa captura no se puede usar en este pedido' });
    }
    if (v.pedido_id === null) await tx.voucherPago.update({ where: { id: v.id }, data: { pedido_id: pedidoId } });
  }
  return adelanto;
}

/**
 * Devuelve un adelanto. Si su caja sigue abierta, se anula y sale de ese cierre. Si la caja ya cerró, el cierre no se
 * toca: el efectivo sale como EGRESO de la caja de HOY (debe estar abierta) y un medio digital o tarjeta queda registrado
 * como devuelto hoy (la devolución por ese medio la hace el local). Aquí se unifica con la anulación de pedido pagado
 * de la rama anulacion-reversion (pedidos-admin/anulacion-pagado.service.ts) al hacer merge.
 */
async function devolverUnoTx(
  tx: Prisma.TransactionClient,
  a: { id: bigint; pedido_id: bigint; caja_id: bigint; medio: string; monto: unknown; anulado_en: Date | null },
  motivo: string,
  porPartyId: bigint,
  codigoPedido?: string,
) {
  const cajaAdelanto = await bloquearCaja(tx, a.caja_id);
  if (a.anulado_en) throw new ConflictException({ codigo: 'ADELANTO_YA_ANULADO', mensaje: 'El adelanto ya estaba anulado' });
  const datos: Prisma.PedidoAdelantoUpdateInput = { anulado_en: new Date(), anulado_por: porPartyId, motivo_anulacion: motivo };
  if (cajaAdelanto?.estado !== 'ABIERTA') {
    const { fechaIso } = obtenerFechaHoraLima();
    const hoy = await tx.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
    const cajaHoy = hoy ? await bloquearCaja(tx, hoy.id) : null;
    const medio = (a.medio || '').toUpperCase();
    if (medio === 'EFECTIVO') {
      if (!cajaHoy || cajaHoy.estado !== 'ABIERTA') {
        throw new HttpException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja de hoy para devolver el efectivo del adelanto' }, HttpStatus.CONFLICT);
      }
      const mov = await tx.movimientoCaja.create({
        data: { caja_id: cajaHoy.id, tipo: 'EGRESO', monto: new Prisma.Decimal(Number(a.monto)), motivo: `Devolución de adelanto${codigoPedido ? ` · ${codigoPedido}` : ''}`.slice(0, 250) },
      });
      datos.devuelto_movimiento_id = mov.id;
    }
    if (cajaHoy) datos.devuelto_en_caja_id = cajaHoy.id;
  }
  await tx.pedidoAdelanto.update({ where: { id: a.id }, data: datos });
  await tx.pedido.update({ where: { id: a.pedido_id }, data: { adelanto_total: { decrement: new Prisma.Decimal(Number(a.monto)) } } });
}

/** Anula (devuelve) un adelanto puntual. */
export async function anularAdelantoTx(tx: Prisma.TransactionClient, adelantoId: bigint, motivo: string, porPartyId: bigint) {
  const previo = await tx.pedidoAdelanto.findUnique({ where: { id: adelantoId } });
  if (!previo) throw new NotFoundException({ codigo: 'ADELANTO_NO_ENCONTRADO', mensaje: 'El adelanto no existe' });
  await devolverUnoTx(tx, previo, motivo, porPartyId);
  return previo;
}

/** Devuelve todos los adelantos vigentes de un pedido (al anularlo con «se devuelve»). */
export async function devolverAdelantosTx(tx: Prisma.TransactionClient, pedidoId: bigint, motivo: string, porPartyId: bigint, codigoPedido?: string) {
  const vigentes = await tx.pedidoAdelanto.findMany({ where: { pedido_id: pedidoId, anulado_en: null }, orderBy: { id: 'asc' } });
  for (const a of vigentes) await devolverUnoTx(tx, a, motivo, porPartyId, codigoPedido);
  return { cantidad: vigentes.length, total: vigentes.reduce((t, a) => t + aCentimos(a.monto), 0) / 100 };
}
