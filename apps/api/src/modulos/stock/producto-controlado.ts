import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

/**
 * Stock de productos terminados que controlan su stock (`producto.controla_stock`).
 * Independiente del interruptor «Control de almacén» (insumos): se descuenta al CREAR el pedido,
 * en la misma transacción, para todos los canales (carta, mozo, caja, WhatsApp).
 * Con conteo de apertura del día hay tope y agotado automático; sin apertura resta pero no limita ni agota.
 */

/** Fecha de hoy en hora de Lima, 'YYYY-MM-DD'. */
export function fechaLimaHoy(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}

/** Fecha 'YYYY-MM-DD' como columna DATE (medianoche UTC, igual que Prisma). */
export function fechaColumna(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

/** Lugar donde vive el saldo del producto: su fila de stock si ya existe; si no, el de su área, Salados o Almacén. */
// ponytail: un producto guarda su saldo en un solo lugar (la primera fila). Si algún día hay varios, habría que sumar.
export async function lugarDelProducto(db: any, productoId: bigint, areaId?: bigint | null): Promise<bigint | null> {
  const fila = await db.stock.findFirst({
    where: { producto_id: productoId },
    orderBy: { id: 'asc' },
    select: { lugar_id: true },
  });
  if (fila) return fila.lugar_id;
  if (areaId) {
    const lugarArea = await db.lugarStock.findFirst({ where: { tipo: 'AREA', area_id: areaId } });
    if (lugarArea) return lugarArea.id;
  }
  const cocina = await db.lugarStock.findFirst({ where: { nombre: 'Salados' } });
  if (cocina) return cocina.id;
  const almacen = await db.lugarStock.findFirst({ where: { tipo: 'ALMACEN' } });
  return almacen?.id ?? null;
}

/** Saldo del producto (suma de sus filas de stock de producto). */
export async function saldoProducto(db: any, productoId: bigint): Promise<number> {
  const filas = await db.stock.findMany({ where: { producto_id: productoId }, select: { cantidad: true } });
  return filas.reduce((acc: number, f: any) => acc + Number(f.cantidad), 0);
}

/** Conteo de apertura del día de un producto, o null si no hay. */
export async function aperturaDeHoy(db: any, productoId: bigint, fecha: string = fechaLimaHoy()) {
  return db.conteoApertura.findUnique({
    where: { fecha_producto_id: { fecha: fechaColumna(fecha), producto_id: productoId } },
  });
}

/**
 * Agotado automático: saldo 0 o menos → agotado hasta reactivar; saldo > 0 → se reactiva si estaba agotado.
 * Reutiliza agotado_hasta y la tabla agotado (igual que cocina y verificarYReactivarAgotados).
 */
export async function sincronizarAgotadoProducto(db: any, productoId: bigint, saldo: number, ahora = new Date()) {
  const prod = await db.producto.findUnique({ where: { id: productoId }, select: { agotado_hasta: true } });
  const agotado = !!prod?.agotado_hasta && new Date(prod.agotado_hasta) > ahora;
  if (saldo <= 0 && !agotado) {
    await db.producto.update({ where: { id: productoId }, data: { agotado_hasta: FECHA_HASTA_REACTIVAR } });
    await db.agotado.create({
      data: {
        producto_id: productoId,
        tipo: 'PRODUCTO',
        alcance: 'HASTA_REACTIVAR',
        desde: ahora,
        hasta: FECHA_HASTA_REACTIVAR,
        por: BigInt(1),
        reactivado_en: null,
      },
    });
    return 'AGOTADO' as const;
  }
  if (saldo > 0 && agotado) {
    await db.producto.update({ where: { id: productoId }, data: { agotado_hasta: null } });
    await db.agotado.updateMany({
      where: { producto_id: productoId, reactivado_en: null },
      data: { reactivado_en: ahora },
    });
    return 'REACTIVADO' as const;
  }
  return null;
}

export interface LineaVentaProducto {
  productoId: bigint;
  cantidad: number;
  areaId?: bigint | null;
}

/**
 * Descuenta del saldo los productos que controlan stock de un pedido recién creado (dentro de su transacción).
 * Suma las líneas repetidas del mismo producto. Con apertura de hoy el descuento es condicional (atómico):
 * si no alcanza, lanza 409 STOCK_INSUFICIENTE y la transacción del pedido se deshace.
 * Devuelve los productos que quedaron agotados por esta venta. Las líneas de productos sin casilla se ignoran.
 */
export async function descontarVentaProductos(
  db: any,
  pedidoId: bigint,
  lineas: LineaVentaProducto[],
  por: bigint,
  ahora = new Date(),
): Promise<{ agotados: bigint[] }> {
  const agregado = new Map<string, { productoId: bigint; cantidad: number; areaId?: bigint | null }>();
  for (const l of lineas) {
    const k = l.productoId.toString();
    const previo = agregado.get(k);
    if (previo) previo.cantidad += l.cantidad;
    else agregado.set(k, { productoId: l.productoId, cantidad: l.cantidad, areaId: l.areaId });
  }
  if (agregado.size === 0) return { agotados: [] };

  const controlados = await db.producto.findMany({
    where: { id: { in: [...agregado.values()].map((a) => a.productoId) }, controla_stock: true },
    select: { id: true, nombre: true },
  });
  const nombres = new Map<string, string>(controlados.map((p: any) => [p.id.toString(), p.nombre]));

  const agotados: bigint[] = [];
  const ordenados = [...agregado.values()]
    .filter((a) => nombres.has(a.productoId.toString()))
    .sort((a, b) => (a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0));

  for (const a of ordenados) {
    const fecha = fechaLimaHoy(ahora);
    const apertura = await aperturaDeHoy(db, a.productoId, fecha);
    const lugarId = await lugarDelProducto(db, a.productoId, a.areaId);
    if (!lugarId) continue;
    const cantidad = new Prisma.Decimal(a.cantidad);

    if (apertura) {
      const r = await db.stock.updateMany({
        where: { producto_id: a.productoId, lugar_id: lugarId, cantidad: { gte: cantidad } },
        data: { cantidad: { decrement: cantidad } },
      });
      if (r.count === 0) {
        const quedan = Math.max(0, Math.floor(await saldoProducto(db, a.productoId)));
        const nombre = nombres.get(a.productoId.toString());
        throw new ConflictException({
          codigo: 'STOCK_INSUFICIENTE',
          mensaje: `Solo quedan ${quedan} de ${nombre}`,
          productoId: a.productoId.toString(),
          quedan,
        });
      }
    } else {
      // Sin apertura de hoy: resta sin límite ni agotado (no se pierden ventas)
      const r = await db.stock.updateMany({
        where: { producto_id: a.productoId, lugar_id: lugarId },
        data: { cantidad: { decrement: cantidad } },
      });
      if (r.count === 0) {
        await db.stock.create({ data: { producto_id: a.productoId, lugar_id: lugarId, cantidad: cantidad.negated() } });
      }
    }

    await db.movimientoStock.create({
      data: {
        tipo: 'VENTA',
        producto_id: a.productoId,
        lugar_id: lugarId,
        cantidad,
        pedido_id: pedidoId,
        por,
        nota: `Venta · pedido ${pedidoId}`,
      },
    });

    if (apertura) {
      const saldo = await saldoProducto(db, a.productoId);
      if ((await sincronizarAgotadoProducto(db, a.productoId, saldo, ahora)) === 'AGOTADO') agotados.push(a.productoId);
    }
  }
  return { agotados };
}

/**
 * Fija el saldo de un producto que controla stock al conteo de apertura del día: ajusta la diferencia con un
 * movimiento AJUSTE («Apertura del día») y guarda/actualiza el conteo de hoy (se puede corregir el mismo día).
 */
export async function fijarAperturaProducto(
  db: any,
  productoId: bigint,
  cantidad: number,
  areaId: bigint | null | undefined,
  por: bigint,
  ahora = new Date(),
  fecha: string = fechaLimaHoy(ahora),
) {
  const lugarId = await lugarDelProducto(db, productoId, areaId);
  if (!lugarId) return;
  const actual = await saldoProducto(db, productoId);
  const diff = new Prisma.Decimal(cantidad).minus(actual);
  if (!diff.isZero()) {
    const fila = await db.stock.findFirst({ where: { producto_id: productoId, lugar_id: lugarId } });
    if (fila) {
      await db.stock.update({ where: { id: fila.id }, data: { cantidad: { increment: diff } } });
    } else {
      await db.stock.create({ data: { producto_id: productoId, lugar_id: lugarId, cantidad: diff } });
    }
    await db.movimientoStock.create({
      data: { tipo: 'AJUSTE', producto_id: productoId, lugar_id: lugarId, cantidad: diff, por, nota: 'Apertura del día' },
    });
  }
  const dia = fechaColumna(fecha);
  await db.conteoApertura.upsert({
    where: { fecha_producto_id: { fecha: dia, producto_id: productoId } },
    update: { cantidad: new Prisma.Decimal(cantidad), lugar_id: lugarId, por, en: ahora },
    create: { fecha: dia, producto_id: productoId, lugar_id: lugarId, cantidad: new Prisma.Decimal(cantidad), por },
  });
  await sincronizarAgotadoProducto(db, productoId, cantidad, ahora);
}

/** Quedan de cada producto con apertura de hoy (entero, mínimo 0). Los demás productos no aparecen en el mapa. */
export async function quedanProductos(db: any, ids: bigint[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;
  const aperturas = await db.conteoApertura.findMany({
    where: { fecha: fechaColumna(fechaLimaHoy()), producto_id: { in: ids } },
    select: { producto_id: true },
  });
  const conApertura = aperturas.map((a: any) => a.producto_id as bigint);
  if (conApertura.length === 0) return mapa;
  const filas = await db.stock.findMany({
    where: { producto_id: { in: conApertura } },
    select: { producto_id: true, cantidad: true },
  });
  const suma = new Map<string, number>();
  for (const f of filas) {
    const k = f.producto_id.toString();
    suma.set(k, (suma.get(k) ?? 0) + Number(f.cantidad));
  }
  for (const id of conApertura) {
    mapa.set(id.toString(), Math.max(0, Math.floor(suma.get(id.toString()) ?? 0)));
  }
  return mapa;
}
