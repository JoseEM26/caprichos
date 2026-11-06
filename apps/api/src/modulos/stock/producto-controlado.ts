import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

/**
 * Stock de productos terminados que controlan su stock (`producto.controla_stock`).
 * Independiente del interruptor «Control de almacén» (insumos): se descuenta al CREAR el pedido,
 * en la misma transacción, para todos los canales (carta, mozo, caja, WhatsApp).
 * Con conteo de apertura del día hay tope y agotado automático; sin apertura resta pero no limita ni agota.
 *
 * Producto POR SABOR (controla_stock y al menos un sabor activo): el saldo vive en `stock_sabor`, uno por sabor.
 * Cada línea reparte sus unidades (tamaño.unidades × cantidad) entre sabores (`sabores: [{saborId, cantidad}]`).
 * Sin sabores activos, el producto sigue con un único saldo en `stock`.
 */

/** Producto que controla stock POR SABOR: la casilla está marcada y tiene al menos un sabor activo. */
export function controlaPorSabor(prod: { controla_stock: boolean; sabores?: Array<{ activo?: boolean }> | null }): boolean {
  return !!prod.controla_stock && (prod.sabores ?? []).some((s) => s.activo !== false);
}

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

/** Conteo de apertura del día de un producto entero (sin sabor), o null si no hay. */
export async function aperturaDeHoy(db: any, productoId: bigint, fecha: string = fechaLimaHoy()) {
  return db.conteoApertura.findFirst({
    where: { fecha: fechaColumna(fecha), producto_id: productoId, sabor_id: null },
  });
}

/** Conteo de apertura del día de un sabor, o null si no hay. */
export async function aperturaDeSaborHoy(db: any, saborId: bigint, fecha: string = fechaLimaHoy()) {
  return db.conteoApertura.findFirst({
    where: { fecha: fechaColumna(fecha), sabor_id: saborId },
  });
}

/** Guarda el conteo de apertura del día (producto entero o sabor): una fila por día y producto/sabor. */
async function guardarConteo(
  db: any,
  c: { fecha: string; productoId: bigint; saborId: bigint | null; lugarId: bigint; cantidad: number; por: bigint; ahora: Date },
) {
  const donde = { fecha: fechaColumna(c.fecha), producto_id: c.productoId, sabor_id: c.saborId };
  const cantidad = new Prisma.Decimal(c.cantidad);
  const existente = await db.conteoApertura.findFirst({ where: donde, select: { id: true } });
  if (existente) {
    await db.conteoApertura.update({
      where: { id: existente.id },
      data: { cantidad, lugar_id: c.lugarId, por: c.por, en: c.ahora },
    });
  } else {
    await db.conteoApertura.create({ data: { ...donde, cantidad, lugar_id: c.lugarId, por: c.por } });
  }
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

/** Sabor repartido en una línea: unidades de ese sabor. */
export interface SaborVenta {
  saborId: bigint;
  nombre: string;
  cantidad: number;
}

export interface LineaVentaProducto {
  productoId: bigint;
  cantidad: number;
  areaId?: bigint | null;
  /** Solo productos por sabor: reparto de sus unidades (suma = unidades del tamaño × cantidad de la línea). */
  sabores?: SaborVenta[];
}

/**
 * Descuenta del saldo los productos que controlan stock de un pedido recién creado (dentro de su transacción).
 * Suma las líneas repetidas del mismo producto (y del mismo sabor). Con apertura de hoy el descuento es condicional
 * (atómico): si no alcanza, lanza 409 STOCK_INSUFICIENTE y la transacción del pedido se deshace.
 * Devuelve los productos y sabores que quedaron agotados por esta venta. Las líneas de productos sin casilla se ignoran.
 */
export async function descontarVentaProductos(
  db: any,
  pedidoId: bigint,
  lineas: LineaVentaProducto[],
  por: bigint,
  ahora = new Date(),
): Promise<{ agotados: bigint[]; saboresAgotados: bigint[] }> {
  const agregado = new Map<string, { productoId: bigint; cantidad: number; areaId?: bigint | null; sabores: Map<string, SaborVenta> }>();
  for (const l of lineas) {
    const k = l.productoId.toString();
    let previo = agregado.get(k);
    if (!previo) {
      previo = { productoId: l.productoId, cantidad: 0, areaId: l.areaId, sabores: new Map() };
      agregado.set(k, previo);
    }
    previo.cantidad += l.cantidad;
    for (const s of l.sabores ?? []) {
      const ks = s.saborId.toString();
      const sp = previo.sabores.get(ks);
      if (sp) sp.cantidad += s.cantidad;
      else previo.sabores.set(ks, { ...s });
    }
  }
  if (agregado.size === 0) return { agotados: [], saboresAgotados: [] };

  const controlados = await db.producto.findMany({
    where: { id: { in: [...agregado.values()].map((a) => a.productoId) }, controla_stock: true },
    select: { id: true, nombre: true, sabores: { where: { activo: true }, select: { id: true } } },
  });
  const porId = new Map<string, any>(controlados.map((p: any) => [p.id.toString(), p]));

  const agotados: bigint[] = [];
  const saboresAgotados: bigint[] = [];
  const ordenados = [...agregado.values()]
    .filter((a) => porId.has(a.productoId.toString()))
    .sort((a, b) => (a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0));

  for (const a of ordenados) {
    const prod = porId.get(a.productoId.toString());
    const fecha = fechaLimaHoy(ahora);
    const lugarId = await lugarDelProducto(db, a.productoId, a.areaId);
    if (!lugarId) continue;

    if ((prod.sabores ?? []).length > 0) {
      if (a.sabores.size === 0) {
        throw new BadRequestException({
          codigo: 'SABORES_INVALIDOS',
          mensaje: `Elige los sabores de ${prod.nombre}`,
        });
      }
      const sabores = [...a.sabores.values()].sort((x, y) => (x.saborId < y.saborId ? -1 : x.saborId > y.saborId ? 1 : 0));
      for (const s of sabores) {
        const r = await descontarSabor(db, { pedidoId, productoId: a.productoId, lugarId, sabor: s, por, fecha, ahora });
        if (r === 'AGOTADO') saboresAgotados.push(s.saborId);
      }
      continue;
    }

    const apertura = await aperturaDeHoy(db, a.productoId, fecha);
    const cantidad = new Prisma.Decimal(a.cantidad);

    if (apertura) {
      const r = await db.stock.updateMany({
        where: { producto_id: a.productoId, lugar_id: lugarId, cantidad: { gte: cantidad } },
        data: { cantidad: { decrement: cantidad } },
      });
      if (r.count === 0) {
        const quedan = Math.max(0, Math.floor(await saldoProducto(db, a.productoId)));
        const nombre = prod.nombre;
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
  return { agotados, saboresAgotados };
}

/**
 * Descuenta de un sabor (producto por sabor). Con apertura de hoy del sabor hay tope (409 STOCK_INSUFICIENTE)
 * y agotado automático de ese sabor; sin apertura resta sin límite. Devuelve 'AGOTADO' si esta venta lo dejó agotado.
 */
async function descontarSabor(
  db: any,
  c: { pedidoId: bigint; productoId: bigint; lugarId: bigint; sabor: SaborVenta; por: bigint; fecha: string; ahora: Date },
): Promise<'AGOTADO' | null> {
  const { sabor } = c;
  const cantidad = new Prisma.Decimal(sabor.cantidad);
  const apertura = await aperturaDeSaborHoy(db, sabor.saborId, c.fecha);

  if (apertura) {
    const r = await db.stockSabor.updateMany({
      where: { sabor_id: sabor.saborId, cantidad: { gte: cantidad } },
      data: { cantidad: { decrement: cantidad } },
    });
    if (r.count === 0) {
      const quedan = Math.max(0, Math.floor(await saldoSabor(db, sabor.saborId)));
      throw new ConflictException({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: `Solo quedan ${quedan} de ${sabor.nombre}`,
        productoId: c.productoId.toString(),
        saborId: sabor.saborId.toString(),
        saborNombre: sabor.nombre,
        quedan,
      });
    }
  } else {
    await db.stockSabor.upsert({
      where: { sabor_id: sabor.saborId },
      update: { cantidad: { decrement: cantidad } },
      create: { sabor_id: sabor.saborId, cantidad: cantidad.negated() },
    });
  }

  await db.movimientoStock.create({
    data: {
      tipo: 'VENTA',
      producto_id: c.productoId,
      sabor_id: sabor.saborId,
      lugar_id: c.lugarId,
      cantidad,
      pedido_id: c.pedidoId,
      por: c.por,
      nota: `Venta · pedido ${c.pedidoId} · ${sabor.nombre}`,
    },
  });

  if (apertura) {
    const saldo = await saldoSabor(db, sabor.saborId);
    if ((await sincronizarAgotadoSabor(db, sabor.saborId, saldo, c.ahora, c.por)) === 'AGOTADO') return 'AGOTADO';
  }
  return null;
}

/** Saldo de un sabor (0 si nunca tuvo fila). */
export async function saldoSabor(db: any, saborId: bigint): Promise<number> {
  const fila = await db.stockSabor.findUnique({ where: { sabor_id: saborId }, select: { cantidad: true } });
  return fila ? Number(fila.cantidad) : 0;
}

/**
 * Agotado automático de un sabor: saldo 0 o menos (con apertura de hoy) → agotado hasta reactivar;
 * saldo > 0 → se reactiva si estaba agotado. Reutiliza sabor.agotado_hasta y la tabla agotado (tipo SABOR).
 */
export async function sincronizarAgotadoSabor(db: any, saborId: bigint, saldo: number, ahora = new Date(), por: bigint = BigInt(1)) {
  const sab = await db.sabor.findUnique({ where: { id: saborId }, select: { agotado_hasta: true, producto_id: true } });
  const agotado = !!sab?.agotado_hasta && new Date(sab.agotado_hasta) > ahora;
  if (saldo <= 0 && !agotado) {
    await db.sabor.update({ where: { id: saborId }, data: { agotado_hasta: FECHA_HASTA_REACTIVAR } });
    await db.agotado.create({
      data: {
        sabor_id: saborId,
        tipo: 'SABOR',
        alcance: 'HASTA_REACTIVAR',
        desde: ahora,
        hasta: FECHA_HASTA_REACTIVAR,
        por,
        reactivado_en: null,
      },
    });
    return 'AGOTADO' as const;
  }
  if (saldo > 0 && agotado) {
    await db.sabor.update({ where: { id: saborId }, data: { agotado_hasta: null } });
    await db.agotado.updateMany({
      where: { sabor_id: saborId, reactivado_en: null },
      data: { reactivado_en: ahora },
    });
    return 'REACTIVADO' as const;
  }
  return null;
}

/**
 * Valida el reparto de sabores de una línea de un producto por sabor.
 * 400 SABORES_INVALIDOS si faltan, no pertenecen al producto, no están activos o no suman unidades × cantidad;
 * 409 SABOR_AGOTADO si un sabor está agotado. Devuelve el reparto ya agregado por sabor.
 */
export function validarSaboresLinea(
  prod: { id: bigint; nombre: string; sabores: Array<{ id: bigint; nombre: string; activo: boolean; agotado_hasta: Date | null }> },
  unidades: number,
  cantidad: number,
  enviados: unknown,
  ahora = new Date(),
): SaborVenta[] {
  const invalido = (mensaje: string) => new BadRequestException({ codigo: 'SABORES_INVALIDOS', mensaje });
  if (!Array.isArray(enviados) || enviados.length === 0) {
    throw invalido(`Elige los sabores de ${prod.nombre}`);
  }
  const porSabor = new Map<string, SaborVenta>();
  for (const it of enviados) {
    let saborId: bigint;
    try {
      saborId = BigInt((it as any)?.saborId);
    } catch {
      throw invalido(`Sabor no válido en ${prod.nombre}`);
    }
    const n = Math.floor(Number((it as any)?.cantidad));
    if (!Number.isFinite(n) || n < 1) throw invalido(`La cantidad de cada sabor de ${prod.nombre} debe ser al menos 1`);

    const sab = prod.sabores.find((s) => s.id === saborId);
    if (!sab) throw invalido(`El sabor no pertenece a ${prod.nombre}`);
    if (!sab.activo) throw invalido(`El sabor ${sab.nombre} no está activo`);
    if (sab.agotado_hasta && new Date(sab.agotado_hasta) > ahora) {
      throw new ConflictException({
        codigo: 'SABOR_AGOTADO',
        mensaje: `El sabor ${sab.nombre} está agotado`,
        productoId: prod.id.toString(),
        saborId: sab.id.toString(),
        saborNombre: sab.nombre,
      });
    }

    const previo = porSabor.get(saborId.toString());
    if (previo) previo.cantidad += n;
    else porSabor.set(saborId.toString(), { saborId: sab.id, nombre: sab.nombre, cantidad: n });
  }

  const total = unidades * cantidad;
  const suma = [...porSabor.values()].reduce((acc, s) => acc + s.cantidad, 0);
  if (suma !== total) {
    throw invalido(
      `Reparte ${total} unidad(es) de ${prod.nombre} entre sus sabores (ahora suman ${suma})`,
    );
  }
  return [...porSabor.values()];
}

/** Estado de hoy de cada sabor: saldo y si tiene conteo de apertura hoy (quedan = saldo, nunca negativo). */
export async function estadoSaboresHoy(
  db: any,
  saborIds: bigint[],
  fecha: string = fechaLimaHoy(),
): Promise<Map<string, { saldo: number; aperturaHoy: boolean; aperturaCantidad: number | null }>> {
  const mapa = new Map<string, { saldo: number; aperturaHoy: boolean; aperturaCantidad: number | null }>();
  if (saborIds.length === 0) return mapa;
  const [aperturas, filas] = await Promise.all([
    db.conteoApertura.findMany({
      where: { fecha: fechaColumna(fecha), sabor_id: { in: saborIds } },
      select: { sabor_id: true, cantidad: true },
    }),
    db.stockSabor.findMany({ where: { sabor_id: { in: saborIds } }, select: { sabor_id: true, cantidad: true } }),
  ]);
  const ap = new Map<string, number>(aperturas.map((a: any) => [a.sabor_id.toString(), Number(a.cantidad)]));
  const saldo = new Map<string, number>(filas.map((f: any) => [f.sabor_id.toString(), Number(f.cantidad)]));
  for (const id of saborIds) {
    const k = id.toString();
    const cant = ap.get(k);
    mapa.set(k, {
      saldo: saldo.get(k) ?? 0,
      aperturaHoy: cant !== undefined,
      aperturaCantidad: cant ?? null,
    });
  }
  return mapa;
}

/** Fija el saldo de un sabor al conteo de apertura del día (movimiento AJUSTE «Apertura del día»). */
export async function fijarAperturaSabor(
  db: any,
  productoId: bigint,
  saborId: bigint,
  cantidad: number,
  areaId: bigint | null | undefined,
  por: bigint,
  ahora = new Date(),
  fecha: string = fechaLimaHoy(ahora),
) {
  const lugarId = await lugarDelProducto(db, productoId, areaId);
  if (!lugarId) return;
  const actual = await saldoSabor(db, saborId);
  const diff = new Prisma.Decimal(cantidad).minus(actual);
  if (!diff.isZero()) {
    await db.stockSabor.upsert({
      where: { sabor_id: saborId },
      update: { cantidad: { increment: diff } },
      create: { sabor_id: saborId, cantidad: diff },
    });
    await db.movimientoStock.create({
      data: {
        tipo: 'AJUSTE',
        producto_id: productoId,
        sabor_id: saborId,
        lugar_id: lugarId,
        cantidad: diff,
        por,
        nota: 'Apertura del día',
      },
    });
  }
  await guardarConteo(db, { fecha, productoId, saborId, lugarId, cantidad, por, ahora });
  await sincronizarAgotadoSabor(db, saborId, cantidad, ahora, por);
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
  await guardarConteo(db, { fecha, productoId, saborId: null, lugarId, cantidad, por, ahora });
  await sincronizarAgotadoProducto(db, productoId, cantidad, ahora);
}

/** Quedan de cada producto con apertura de hoy (entero, mínimo 0). Los demás productos no aparecen en el mapa. */
export async function quedanProductos(db: any, ids: bigint[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;
  const aperturas = await db.conteoApertura.findMany({
    where: { fecha: fechaColumna(fechaLimaHoy()), producto_id: { in: ids }, sabor_id: null },
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

/** Sabor tal como lo ve la carta y el admin: disponible (activo, no agotado y con saldo si hay apertura hoy) y quedan. */
export function estadoSaborCarta(
  s: { id: bigint; nombre: string; activo: boolean; agotado_hasta: Date | null },
  e: { saldo: number; aperturaHoy: boolean } | undefined,
  ahora = new Date(),
) {
  const quedan = e?.aperturaHoy ? Math.max(0, Math.floor(e.saldo)) : null;
  const agotado = !!s.agotado_hasta && new Date(s.agotado_hasta) > ahora;
  return {
    id: s.id.toString(),
    nombre: s.nombre,
    activo: s.activo,
    disponible: s.activo && !agotado && !(quedan !== null && quedan <= 0),
    quedan,
  };
}
