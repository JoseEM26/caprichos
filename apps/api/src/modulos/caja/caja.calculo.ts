import { HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { obtenerFechaHoraLima } from '../local/local.util';

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
  /** Propinas cobradas (van aparte de la venta; ya están dentro de esperadoEfectivo y de los sistema*). */
  propinasEfectivo: number;
  propinasDigitales: number;
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

/**
 * Cobros vigentes de una caja en el formato que listan Pedidos y el cierre (CobroTurno).
 * Lo usan la caja de hoy y la caja abierta de cualquier día: así las dos listas son iguales.
 */
export function mapearCobrosCaja(
  cobros: Array<{
    pedido_id: bigint;
    total: unknown;
    en: Date;
    anulado_en: Date | null;
    pedido: { codigo: string; cliente_nombre: string | null };
    pagos: Array<{ medio: string | null }>;
  }>,
) {
  return cobros
    .filter((c) => !c.anulado_en)
    .map((c) => ({
      pedidoId: c.pedido_id.toString(),
      codigo: c.pedido.codigo,
      cliente: c.pedido.cliente_nombre,
      total: enPesos(aCentimos(c.total)),
      medios: c.pagos.map((p) => (p.medio || '').toUpperCase()),
      en: c.en,
    }));
}

/** Movimientos de caja chica en el formato de la pantalla (incluye los anulados, marcados). */
export function mapearMovimientosCaja(
  movimientos: Array<{
    id: bigint;
    caja_id: bigint;
    tipo: string;
    monto: unknown;
    motivo: string;
    anulado_en: Date | null;
    motivo_anulacion: string | null;
  }>,
) {
  return movimientos.map((m) => ({
    id: m.id.toString(),
    caja_id: m.caja_id.toString(),
    tipo: m.tipo,
    monto: Number(m.monto),
    motivo: m.motivo,
    anulado_en: m.anulado_en,
    motivo_anulacion: m.motivo_anulacion,
  }));
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

/** Mensaje que ve el admin cuando se intenta cobrar o aprobar un pago con la caja cerrada. */
export const MENSAJE_CAJA_CERRADA_PAGOS = 'La caja está cerrada. Abre caja para cobrar y aprobar pagos.';

/**
 * Exige que la caja de hoy (día de Lima) esté abierta para cobrar o aprobar un pago. Si no lo está,
 * lanza el 409 que corresponde: CAJA_ANTERIOR_SIN_CERRAR si una caja de otro día sigue abierta, o
 * CAJA_CERRADA. Es la única verificación de «caja abierta» para aprobaciones; los pedidos no la usan.
 */
export async function exigirCajaAbiertaHoy(db: Prisma.TransactionClient): Promise<void> {
  const { fechaIso } = obtenerFechaHoraLima();
  const caja = await db.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
  if (caja?.estado === 'ABIERTA') return;
  throw (
    (await errorCajaAnteriorAbierta(db)) ??
    new HttpException({ codigo: 'CAJA_CERRADA', mensaje: MENSAJE_CAJA_CERRADA_PAGOS }, HttpStatus.CONFLICT)
  );
}

/**
 * Egreso de la caja de hoy por una devolución en efectivo (dentro de la transacción de la devolución).
 * Bloquea la caja; si no está abierta hoy, lanza un 409 con el mensaje para el cajero.
 */
export async function registrarEgresoDevolucionCajaHoy(
  tx: Prisma.TransactionClient,
  monto: number,
  motivo: string,
): Promise<{ id: bigint }> {
  const { fechaIso } = obtenerFechaHoraLima();
  const caja = await tx.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
  const bloqueada = caja ? await bloquearCaja(tx, caja.id) : null;
  if (!bloqueada || bloqueada.estado !== 'ABIERTA') {
    throw new HttpException(
      { codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja para devolver en efectivo' },
      HttpStatus.CONFLICT,
    );
  }
  return tx.movimientoCaja.create({
    data: { caja_id: bloqueada.id, tipo: 'EGRESO', monto: new Prisma.Decimal(monto), motivo },
    select: { id: true },
  });
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
      cobros: { include: { pagos: true } },
      planPago: true,
    },
  });
}

/**
 * Cobro vigente de un pedido: el que no está anulado. Un pedido puede tener varios cobros
 * (el anulado se conserva, RNF-CAP-014), pero solo uno vigente.
 */
export function cobroVigente<T extends { anulado_en: Date | null }>(
  cobros: T[] | null | undefined,
): T | null {
  return (cobros ?? []).find((c) => !c.anulado_en) ?? null;
}

/**
 * Efectivo (en céntimos) que el repartidor trae y debe liquidar: solo el contra entrega, es decir,
 * pedido en efectivo sin cobro vigente en caja (RN-CAP-088). Lo cobrado en caja ya entra por su medio.
 */
export function efectivoDelRepartidor(p: {
  total: unknown;
  pago_metodo: string | null;
  cobros: { anulado_en: Date | null }[];
  /** Plan de pago (pago dividido o cambio de cobro aprobado en la puerta): cuenta solo su renglón EFECTIVO */
  planPago?: { medio: string; monto: unknown }[] | null;
}): number {
  if (cobroVigente(p.cobros)) return 0;
  if (p.planPago && p.planPago.length > 0) {
    return p.planPago.filter((f) => f.medio === 'EFECTIVO').reduce((acc, f) => acc + aCentimos(f.monto), 0);
  }
  return p.pago_metodo === 'EFECTIVO' ? aCentimos(p.total) : 0;
}

/**
 * Montos que el sistema espera en la caja. Todo cobro vigente de la caja cuenta por su medio,
 * también el de un delivery cobrado en caja. El efectivo contra entrega del repartidor no cuenta
 * hasta que se liquida (RN-CAP-088): la liquidación suma lo que entregó, sin duplicarlo.
 */
export async function calcularMontosCaja(
  cliente: ClienteCaja,
  caja: { id: bigint; fecha: Date; apertura: unknown },
): Promise<MontosSistema> {
  const cobros = await cliente.cobro.findMany({
    where: { caja_id: caja.id, anulado_en: null },
    include: { pagos: true },
  });

  let ventasEfectivo = 0;
  let propinasEfectivo = 0;
  let propinasDigitales = 0;
  let sistemaYape = 0;
  let sistemaPlin = 0;
  let sistemaTransferencia = 0;
  let sistemaTarjeta = 0;

  // pago.monto es la venta del renglón y pago.propina su propina: lo que entró por el medio es la suma.
  // Las ventas (ventasEfectivo) no incluyen propina; el efectivo esperado sí, porque está en la caja.
  for (const cobro of cobros) {
    for (const pago of cobro.pagos) {
      const medio = (pago.medio || '').trim().toUpperCase();
      const monto = aCentimos(pago.monto);
      const propina = aCentimos(pago.propina);
      if (medio === 'EFECTIVO') {
        ventasEfectivo += monto;
        propinasEfectivo += propina;
      } else if (medio === 'YAPE') {
        sistemaYape += monto + propina;
        propinasDigitales += propina;
      } else if (medio === 'PLIN') {
        sistemaPlin += monto + propina;
        propinasDigitales += propina;
      } else if (medio === 'TRANSFERENCIA') {
        sistemaTransferencia += monto + propina;
        propinasDigitales += propina;
      } else if (medio === 'TARJETA') {
        sistemaTarjeta += monto + propina;
        propinasDigitales += propina;
      }
    }
  }

  // Devoluciones del día de la caja: la propina del pedido devuelto sale ese día (por el medio de su cobro).
  // Es el mismo criterio del acumulado mensual (resumenMes), así que el cierre y el acumulado no divergen.
  // Las ventas por medio no cambian: igual que hoy, una devolución no resta de sistemaYape/Plin/etc.
  const inicioDia = new Date(caja.fecha.getTime() + 5 * 60 * 60 * 1000);
  const devueltos = await cliente.pedido.findMany({
    where: { devolucion: { is: { creado_en: { gte: inicioDia, lt: new Date(inicioDia.getTime() + MS_DIA) } } } },
    select: { cobros: { where: { anulado_en: null }, select: { pagos: { select: { medio: true, propina: true } } } } },
  });
  for (const p of devueltos) {
    for (const cobro of p.cobros ?? []) {
      for (const pago of cobro.pagos ?? []) {
        const propina = aCentimos(pago.propina);
        const medio = (pago.medio || '').trim().toUpperCase();
        if (medio === 'EFECTIVO') propinasEfectivo -= propina;
        else if (['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'].includes(medio)) propinasDigitales -= propina;
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
    aCentimos(caja.apertura) + ventasEfectivo + propinasEfectivo + liquidadoEfectivo + ingresos - egresos;

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
    propinasEfectivo: enPesos(propinasEfectivo),
    propinasDigitales: enPesos(propinasDigitales),
  };
}
