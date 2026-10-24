import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Medios de pago que admite un cobro (RN-CAP-011). */
export const MEDIOS_COBRO = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/** Lima no tiene horario de verano: 00:00 locales son las 05:00 UTC. */
const MS_DIA = 24 * 60 * 60 * 1000;

export interface MontosSistema {
  esperadoEfectivo: number;
  sistemaYape: number;
  sistemaPlin: number;
  sistemaTransferencia: number;
  sistemaTarjeta: number;
  ventasEfectivo: number;
  ingresos: number;
  egresos: number;
  liquidadoEfectivo: number;
}

/** Subconjunto de PrismaService/TransactionClient que usa el cálculo de caja. */
export type ClienteCaja = Pick<
  Prisma.TransactionClient,
  'cobro' | 'movimientoCaja' | 'liquidacion' | 'pedido'
>;

/** Pesos a céntimos enteros: los montos se suman en enteros, nunca en floats. */
export function aCentimos(valor: unknown): number {
  return Math.round(Number(valor ?? 0) * 100);
}

export function enPesos(centimos: number): number {
  return centimos / 100;
}

/** Un monto válido tiene como máximo dos decimales. */
export function esCentimosValidos(valor: number): boolean {
  return Math.abs(valor * 100 - Math.round(valor * 100)) < 1e-6;
}

/**
 * Bloquea la fila de la caja hasta el fin de la transacción. Cobros, anulaciones,
 * arqueos, liquidaciones y cierres pasan por aquí: así no se cobra en una caja que
 * se está cerrando y no hay dos cierres ni dos cobros del mismo pedido a la vez.
 */
export async function bloquearCaja(tx: Prisma.TransactionClient, cajaId: bigint) {
  await tx.$queryRaw`SELECT id FROM caja WHERE id = ${cajaId} FOR UPDATE`;
  return tx.caja.findUnique({ where: { id: cajaId } });
}

/**
 * Si una caja abierta de un día anterior impide tener la de hoy, devuelve el error que lo dice
 * (CAJA_ANTERIOR_SIN_CERRAR). Abrir, cobrar y registrar movimientos lo usan: así no piden
 * «abre la caja» cuando la de hoy no se puede abrir. Si no hay ninguna abierta, devuelve null.
 */
export async function errorCajaAnteriorAbierta(tx: Prisma.TransactionClient) {
  const anterior = await tx.caja.findFirst({ where: { estado: 'ABIERTA' } });
  if (!anterior) return null;
  const dia = anterior.fecha.toISOString().slice(0, 10).split('-').reverse().join('/');
  return new HttpException(
    {
      codigo: 'CAJA_ANTERIOR_SIN_CERRAR',
      mensaje: `La caja del ${dia} sigue abierta: ciérrala en «Caja y cierres» antes de cobrar, registrar movimientos o abrir la de hoy`,
    },
    HttpStatus.CONFLICT,
  );
}

/**
 * Pedidos delivery entregados el día de la caja (hora de Lima). Son los que el repartidor
 * cobró en efectivo y entrega en la liquidación (RN-CAP-088).
 */
export function pedidosRepartoDelDia(cliente: ClienteCaja, fechaIso: string) {
  const inicio = new Date(`${fechaIso}T05:00:00.000Z`);
  const fin = new Date(inicio.getTime() + MS_DIA);

  return cliente.pedido.findMany({
    where: {
      modalidad: 'DELIVERY',
      estado: 'ENTREGADO',
      repartidor_party_id: { not: null },
      entregado_en: { gte: inicio, lt: fin },
    },
    include: {
      repartidor: { include: { persona: true } },
      cobro: { include: { pagos: true } },
    },
  });
}

/**
 * Efectivo (en céntimos) que el repartidor debe entregar por un pedido: lo cobrado en efectivo
 * si hay cobro vigente, o el total si es contra entrega sin cobro.
 */
export function efectivoDelRepartidor(p: {
  total: unknown;
  pago_metodo: string | null;
  cobro: { anulado_en: Date | null; pagos: { medio: string; monto: unknown }[] } | null;
}): number {
  if (p.cobro && !p.cobro.anulado_en) {
    return p.cobro.pagos.reduce(
      (acc, pago) =>
        (pago.medio || '').toUpperCase() === 'EFECTIVO' ? acc + aCentimos(pago.monto) : acc,
      0,
    );
  }
  return p.pago_metodo === 'EFECTIVO' ? aCentimos(p.total) : 0;
}

/**
 * Montos que el sistema espera en la caja. El efectivo del repartidor no cuenta hasta que se
 * liquida (RN-CAP-088): sus cobros se excluyen y la liquidación suma lo que entregó.
 */
export async function calcularMontosCaja(
  cliente: ClienteCaja,
  caja: { id: bigint; fecha: Date; apertura: unknown },
): Promise<MontosSistema> {
  const fechaIso = new Date(caja.fecha).toISOString().slice(0, 10);
  const reparto = await pedidosRepartoDelDia(cliente, fechaIso);
  const idsDeReparto = new Set(
    reparto.filter((p) => efectivoDelRepartidor(p) > 0).map((p) => String(p.id)),
  );

  const cobros = await cliente.cobro.findMany({
    where: { caja_id: caja.id, anulado_en: null },
    include: { pagos: true },
  });

  let ventasEfectivo = 0;
  let sistemaYape = 0;
  let sistemaPlin = 0;
  let sistemaTransferencia = 0;
  let sistemaTarjeta = 0;

  for (const cobro of cobros) {
    const esDeReparto = idsDeReparto.has(String(cobro.pedido_id));
    for (const pago of cobro.pagos) {
      const medio = (pago.medio || '').trim().toUpperCase();
      const monto = aCentimos(pago.monto);
      if (medio === 'EFECTIVO') {
        if (!esDeReparto) ventasEfectivo += monto;
      } else if (medio === 'YAPE') {
        sistemaYape += monto;
      } else if (medio === 'PLIN') {
        sistemaPlin += monto;
      } else if (medio === 'TRANSFERENCIA') {
        sistemaTransferencia += monto;
      } else if (medio === 'TARJETA') {
        sistemaTarjeta += monto;
      }
    }
  }

  const movimientos = await cliente.movimientoCaja.findMany({
    where: { caja_id: caja.id, anulado_en: null },
  });

  let ingresos = 0;
  let egresos = 0;
  for (const mov of movimientos) {
    const tipo = (mov.tipo || '').trim().toUpperCase();
    if (tipo === 'INGRESO') ingresos += aCentimos(mov.monto);
    else if (tipo === 'EGRESO') egresos += aCentimos(mov.monto);
  }

  const liquidaciones = await cliente.liquidacion.findMany({ where: { caja_id: caja.id } });
  const liquidadoEfectivo = liquidaciones.reduce((acc, liq) => acc + aCentimos(liq.entregado), 0);

  const esperado =
    aCentimos(caja.apertura) + ventasEfectivo + liquidadoEfectivo + ingresos - egresos;

  return {
    esperadoEfectivo: enPesos(esperado),
    sistemaYape: enPesos(sistemaYape),
    sistemaPlin: enPesos(sistemaPlin),
    sistemaTransferencia: enPesos(sistemaTransferencia),
    sistemaTarjeta: enPesos(sistemaTarjeta),
    ventasEfectivo: enPesos(ventasEfectivo),
    ingresos: enPesos(ingresos),
    egresos: enPesos(egresos),
    liquidadoEfectivo: enPesos(liquidadoEfectivo),
  };
}
