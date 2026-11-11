import { Prisma } from '@prisma/client';

/**
 * Operaciones atómicas de stock de insumos usadas por el consumo por receta, las tandas, los pendientes de Almacén y
 * el recuento. Todas reciben el cliente de una transacción. Nada se borra: todo cambio queda en `movimiento_stock`.
 */
export type Tx = Prisma.TransactionClient;

export const NOMBRE_COCINA = 'Salados';
export const NOMBRE_ALMACEN = 'Almacén central';
const NS_LOCK = 74201;
export const redondear3 = (n: number) => Math.round(n * 1000) / 1000;
const r3 = redondear3;

/** Serializa los movimientos del mismo insumo (el stock no tiene clave única por lugar): vale hasta el fin de la transacción. */
export async function bloquearInsumo(tx: Tx, insumoId: bigint): Promise<void> {
  const t: any = tx;
  if (typeof t.$executeRaw === 'function') {
    await t.$executeRaw`SELECT pg_advisory_xact_lock(${NS_LOCK}::int, ${Number(insumoId % BigInt(2147483647))}::int)`;
  }
}

/**
 * «La Cocina» de consumo: un ÚNICO lugar de stock para el consumo por recetas, las tandas, los pendientes y el recuento.
 * Regla: el lugar llamado «Cocina» si existe; si no, «Salados» (el lugar de cocina que el sistema ya usaba); si no hay
 * ninguno, se crea «Cocina». No importa cuántos lugares por área existan: aquí nunca se reparte por área.
 */
export async function lugarCocina(db: any) {
  for (const nombre of ['Cocina', NOMBRE_COCINA]) {
    const l = await db.lugarStock.findUnique({ where: { nombre } });
    if (l) return l;
  }
  return db.lugarStock.create({ data: { nombre: 'Cocina', tipo: 'AREA' } });
}

/**
 * Cantidad real a descontar de un insumo: la neta de la receta ÷ (1 − merma habitual del insumo), redondeada una sola vez
 * a 3 decimales. Merma 0 o inválida (negativa o 100 % o más) = sin merma.
 */
export function consumoRealConMerma(neta: number, mermaPct: number | string | { toString(): string } | null | undefined): number {
  const m = Number(mermaPct ?? 0);
  const factor = Number.isFinite(m) && m > 0 && m < 100 ? 1 - m / 100 : 1;
  return redondear3(neta / factor);
}

/** Lugar por nombre; si no existe lo crea (como hace el resto de Almacén). */
export async function lugarPorNombre(tx: Tx, nombre: string) {
  const l = await tx.lugarStock.findUnique({ where: { nombre } });
  if (l) return l;
  return tx.lugarStock.create({ data: { nombre, tipo: nombre === NOMBRE_ALMACEN ? 'ALMACEN' : 'AREA' } });
}

export interface MovimientoInsumo {
  insumoId: bigint;
  lugarId: bigint;
  /** Con signo: positivo entra al lugar, negativo sale. */
  delta: number;
  tipo: string;
  por: bigint;
  nota: string;
  pedidoId?: bigint | null;
  lineaId?: bigint | null;
  produccionId?: bigint | null;
  trasladoId?: bigint | null;
}

/** Aplica el cambio al stock (actualización atómica, permite negativo) y deja el movimiento. Devuelve el saldo antes y después. */
export async function moverInsumo(tx: Tx, m: MovimientoInsumo): Promise<{ antes: number; despues: number }> {
  await bloquearInsumo(tx, m.insumoId);
  const d = new Prisma.Decimal(m.delta).toDecimalPlaces(3);
  const st = await tx.stock.findFirst({ where: { insumo_id: m.insumoId, lugar_id: m.lugarId } });
  let despues: number;
  if (!st) {
    await tx.stock.create({ data: { insumo_id: m.insumoId, lugar_id: m.lugarId, cantidad: d } });
    despues = Number(d);
  } else {
    const u = await tx.stock.update({ where: { id: st.id }, data: { cantidad: { increment: d } } });
    despues = Number(u.cantidad);
  }
  await tx.movimientoStock.create({
    data: {
      tipo: m.tipo,
      insumo_id: m.insumoId,
      lugar_id: m.lugarId,
      cantidad: d,
      pedido_id: m.pedidoId ?? null,
      pedido_linea_id: m.lineaId ?? null,
      produccion_id: m.produccionId ?? null,
      traslado_id: m.trasladoId ?? null,
      nota: m.nota,
      por: m.por,
    },
  });
  return { antes: r3(despues - Number(d)), despues: r3(despues) };
}

export interface OrigenPendiente {
  tipo: 'LINEA' | 'TANDA';
  pedidoId?: bigint | null;
  lineaId?: bigint | null;
  produccionId?: bigint | null;
}

const whereOrigen = (o: OrigenPendiente) =>
  o.tipo === 'LINEA' ? { pedido_linea_id: o.lineaId ?? undefined } : { produccion_id: o.produccionId ?? undefined };

/** Suma el faltante al pendiente abierto del mismo origen e insumo (o abre uno nuevo). */
export async function registrarPendiente(
  tx: Tx,
  p: { insumoId: bigint; lugarId: bigint; faltante: number; origen: OrigenPendiente; nota?: string },
): Promise<void> {
  if (p.faltante <= 0) return;
  const f = new Prisma.Decimal(p.faltante).toDecimalPlaces(3);
  const abierto = await tx.pendienteAlmacen.findFirst({
    where: { insumo_id: p.insumoId, estado: 'PENDIENTE', origen_tipo: p.origen.tipo, ...whereOrigen(p.origen) },
  });
  if (abierto) {
    await tx.pendienteAlmacen.update({ where: { id: abierto.id }, data: { cantidad: { increment: f } } });
    return;
  }
  await tx.pendienteAlmacen.create({
    data: {
      insumo_id: p.insumoId,
      lugar_id: p.lugarId,
      cantidad: f,
      origen_tipo: p.origen.tipo,
      pedido_id: p.origen.pedidoId ?? null,
      pedido_linea_id: p.origen.lineaId ?? null,
      produccion_id: p.origen.produccionId ?? null,
      nota: p.nota ?? null,
    },
  });
}

export const saldoPendiente = (p: { cantidad: any; emitido: any; ajustado: any }) =>
  r3(Number(p.cantidad) - Number(p.emitido) - Number(p.ajustado));

/** Estado cuando el saldo llega a cero. */
export function estadoCerrado(p: { emitido: any; ajustado: any }): 'EMITIDO' | 'AJUSTADO' | 'ANULADO' {
  if (Number(p.emitido) > 0) return 'EMITIDO';
  if (Number(p.ajustado) > 0) return 'AJUSTADO';
  return 'ANULADO';
}

/** Al devolver insumo a Cocina (se deshizo lo preparado o se anuló una tanda) baja el faltante del mismo origen, del más nuevo al más viejo. */
export async function reducirPendientes(
  tx: Tx,
  p: { insumoId: bigint; devuelto: number; origen: OrigenPendiente; por: bigint },
): Promise<void> {
  let resto = p.devuelto;
  const abiertos = await tx.pendienteAlmacen.findMany({
    where: { insumo_id: p.insumoId, estado: 'PENDIENTE', origen_tipo: p.origen.tipo, ...whereOrigen(p.origen) },
    orderBy: { creado_en: 'desc' },
  });
  for (const a of abiertos) {
    if (resto <= 0) break;
    const saldo = saldoPendiente(a);
    const baja = Math.min(saldo, resto);
    if (baja <= 0) continue;
    resto = r3(resto - baja);
    const nuevaCantidad = r3(Number(a.cantidad) - baja);
    const cierra = r3(nuevaCantidad - Number(a.emitido) - Number(a.ajustado)) <= 0;
    await tx.pendienteAlmacen.update({
      where: { id: a.id },
      data: {
        cantidad: new Prisma.Decimal(nuevaCantidad),
        ...(cierra ? { estado: estadoCerrado(a), resuelto_en: new Date(), resuelto_por: p.por } : {}),
      },
    });
  }
}
