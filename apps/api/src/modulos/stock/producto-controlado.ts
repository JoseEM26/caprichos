import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

/**
 * Stock de productos terminados que controlan su stock (`producto.controla_stock`).
 * Independiente del interruptor «Control de almacén» (insumos): se descuenta al CREAR el pedido,
 * en la misma transacción, para todos los canales (carta, mozo, caja, WhatsApp).
 * El SALDO es siempre el tope: haya o no conteo de apertura de hoy. Una venta que no alcanza responde 409 y no
 * descuenta; al llegar a 0 el producto (o sabor) queda agotado solo. El stock no se reinicia cada día: lo que sobra
 * pasa al día siguiente y la apertura solo SUMA («Quedaron de ayer» + «Produje hoy»). El conteo de apertura es
 * informativo (pantalla de apertura: «Falta la apertura de hoy»).
 *
 * Producto POR SABOR (controla_stock y al menos un sabor activo): el saldo vive en `stock_sabor`, uno por sabor.
 * Cada línea reparte sus unidades (tamaño.unidades × cantidad) entre sabores (`sabores: [{saborId, cantidad}]`).
 * Sin sabores activos, el producto sigue con un único saldo en `stock`.
 */

/**
 * Producto que controla stock POR SABOR: la casilla está marcada, tiene al menos un sabor activo y NO es anfitrión
 * de una oferta COMBO (un Dúo se arma con los grupos del combo, no con una mezcla de sabores propia).
 */
export function controlaPorSabor(prod: {
  controla_stock: boolean;
  sabores?: Array<{ activo?: boolean }> | null;
  ofertasAlcance?: Array<unknown> | null;
}): boolean {
  if ((prod.ofertasAlcance ?? []).length > 0) return false;
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
 * Suma las líneas repetidas del mismo producto (y del mismo sabor). El descuento es condicional (atómico) contra el
 * saldo, haya o no apertura de hoy: si no alcanza (saldo 0 incluido), lanza 409 STOCK_INSUFICIENTE y la transacción
 * del pedido se deshace. Devuelve los productos y sabores que quedaron agotados por esta venta. Las líneas de
 * productos sin casilla se ignoran.
 */
export async function descontarVentaProductos(
  db: any,
  pedidoId: bigint | null,
  lineas: LineaVentaProducto[],
  por: bigint,
  ahora = new Date(),
  /** CORTESIA: salida por cortesía por separado (sin pedido propio). Por defecto VENTA. */
  opciones: { tipo?: 'VENTA' | 'CORTESIA' } = {},
): Promise<{ agotados: bigint[]; saboresAgotados: bigint[] }> {
  const tipo = opciones.tipo ?? 'VENTA';
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
    select: {
      id: true,
      nombre: true,
      sabores: { where: { activo: true }, select: { id: true } },
      ofertasAlcance: { where: { tipo: 'COMBO' }, select: { id: true }, take: 1 },
    },
  });
  const porId = new Map<string, any>(controlados.map((p: any) => [p.id.toString(), p]));

  const agotados: bigint[] = [];
  const saboresAgotados: bigint[] = [];
  const ordenados = [...agregado.values()]
    .filter((a) => porId.has(a.productoId.toString()))
    .sort((a, b) => (a.productoId < b.productoId ? -1 : a.productoId > b.productoId ? 1 : 0));

  for (const a of ordenados) {
    const prod = porId.get(a.productoId.toString());
    const lugarId = await lugarDelProducto(db, a.productoId, a.areaId);
    if (!lugarId) continue;

    // Anfitrión de combo (oferta COMBO): no se descuenta por sabor aunque le queden filas de sabor
    if ((prod.sabores ?? []).length > 0 && (prod.ofertasAlcance ?? []).length === 0) {
      if (a.sabores.size === 0) {
        throw new BadRequestException({
          codigo: 'SABORES_INVALIDOS',
          mensaje: `Elige los sabores de ${prod.nombre}`,
        });
      }
      const sabores = [...a.sabores.values()].sort((x, y) => (x.saborId < y.saborId ? -1 : x.saborId > y.saborId ? 1 : 0));
      for (const s of sabores) {
        const r = await descontarSabor(db, { pedidoId, productoId: a.productoId, lugarId, sabor: s, por, ahora, tipo });
        if (r === 'AGOTADO') saboresAgotados.push(s.saborId);
      }
      continue;
    }

    const cantidad = new Prisma.Decimal(a.cantidad);
    const r = await db.stock.updateMany({
      where: { producto_id: a.productoId, lugar_id: lugarId, cantidad: { gte: cantidad } },
      data: { cantidad: { decrement: cantidad } },
    });
    if (r.count === 0) {
      const quedan = Math.max(0, Math.floor(await saldoProducto(db, a.productoId)));
      throw new ConflictException({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: `Solo quedan ${quedan} de ${prod.nombre}`,
        productoId: a.productoId.toString(),
        quedan,
      });
    }

    await db.movimientoStock.create({
      data: {
        tipo,
        producto_id: a.productoId,
        lugar_id: lugarId,
        cantidad,
        pedido_id: pedidoId,
        por,
        nota: tipo === 'CORTESIA' ? 'Cortesía' : `Venta · pedido ${pedidoId}`,
      },
    });

    const saldo = await saldoProducto(db, a.productoId);
    if (saldo <= 0 && (await sincronizarAgotadoProducto(db, a.productoId, saldo, ahora)) === 'AGOTADO') agotados.push(a.productoId);
  }
  return { agotados, saboresAgotados };
}

/**
 * Descuenta de un sabor (producto por sabor). Tope = saldo del sabor, haya o no apertura de hoy: si no alcanza
 * (0 incluido) responde 409 STOCK_INSUFICIENTE y no descuenta. Al llegar a 0 se agota ese sabor solo.
 * Devuelve 'AGOTADO' si esta venta lo dejó agotado.
 */
async function descontarSabor(
  db: any,
  c: { pedidoId: bigint | null; productoId: bigint; lugarId: bigint; sabor: SaborVenta; por: bigint; ahora: Date; tipo: 'VENTA' | 'CORTESIA' },
): Promise<'AGOTADO' | null> {
  const { sabor } = c;
  const cantidad = new Prisma.Decimal(sabor.cantidad);
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

  await db.movimientoStock.create({
    data: {
      tipo: c.tipo,
      producto_id: c.productoId,
      sabor_id: sabor.saborId,
      lugar_id: c.lugarId,
      cantidad,
      pedido_id: c.pedidoId,
      por: c.por,
      nota: c.tipo === 'CORTESIA' ? `Cortesía · ${sabor.nombre}` : `Venta · pedido ${c.pedidoId} · ${sabor.nombre}`,
    },
  });

  const saldo = await saldoSabor(db, sabor.saborId);
  if (saldo <= 0 && (await sincronizarAgotadoSabor(db, sabor.saborId, saldo, c.ahora, c.por)) === 'AGOTADO') return 'AGOTADO';
  return null;
}

/** Saldo de un sabor (0 si nunca tuvo fila). */
export async function saldoSabor(db: any, saborId: bigint): Promise<number> {
  const fila = await db.stockSabor.findUnique({ where: { sabor_id: saborId }, select: { cantidad: true } });
  return fila ? Number(fila.cantidad) : 0;
}

/**
 * Agotado automático de un sabor: saldo 0 o menos → agotado hasta reactivar; saldo > 0 → se reactiva si estaba
 * agotado. Reutiliza sabor.agotado_hasta y la tabla agotado (tipo SABOR). Las ventas y mermas solo lo llaman con saldo 0.
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

/** Ids de productos (sin sabor) que ya tienen conteo de apertura hoy. El saldo arrastra del día anterior, pero el admin necesita saber si falta contar hoy. */
export async function aperturaHoyProductos(db: any, ids: bigint[], fecha: string = fechaLimaHoy()): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await db.conteoApertura.findMany({
    where: { fecha: fechaColumna(fecha), producto_id: { in: ids }, sabor_id: null },
    select: { producto_id: true },
  });
  return new Set(filas.map((f: any) => f.producto_id.toString()));
}

/** Quedan de cada producto que controla stock (saldo entero, mínimo 0). Los demás productos no aparecen en el mapa. */
export async function quedanProductos(db: any, ids: bigint[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (ids.length === 0) return mapa;
  const controlados = await db.producto.findMany({
    where: { id: { in: ids }, controla_stock: true },
    select: { id: true },
  });
  const idsControlados = controlados.map((p: any) => p.id as bigint);
  if (idsControlados.length === 0) return mapa;
  const filas = await db.stock.findMany({
    where: { producto_id: { in: idsControlados } },
    select: { producto_id: true, cantidad: true },
  });
  const suma = new Map<string, number>();
  for (const f of filas) {
    const k = f.producto_id.toString();
    suma.set(k, (suma.get(k) ?? 0) + Number(f.cantidad));
  }
  for (const id of idsControlados) {
    mapa.set(id.toString(), Math.max(0, Math.floor(suma.get(id.toString()) ?? 0)));
  }
  return mapa;
}

/**
 * Sabor tal como lo ve la carta y el admin. Si el producto controla stock, quedan = saldo del sabor (mínimo 0) y
 * disponible exige saldo > 0; si no, no hay tope (quedan null).
 */
export function estadoSaborCarta(
  s: { id: bigint; nombre: string; activo: boolean; agotado_hasta: Date | null },
  e: { saldo: number } | undefined,
  controlaStock: boolean,
  ahora = new Date(),
) {
  const quedan = controlaStock ? Math.max(0, Math.floor(e?.saldo ?? 0)) : null;
  const agotado = !!s.agotado_hasta && new Date(s.agotado_hasta) > ahora;
  return {
    id: s.id.toString(),
    nombre: s.nombre,
    activo: s.activo,
    disponible: s.activo && !agotado && !(quedan !== null && quedan <= 0),
    quedan,
  };
}

/** Nota de los movimientos de producción que suma la apertura del día («Produje hoy»). */
export const NOTA_PRODUCE_HOY = 'Produje hoy';

/** Motivos de merma de producto terminado. Sin código de supervisor: queda auditada en movimiento_stock (quién y cuándo). */
export const MOTIVOS_MERMA_PRODUCTO = ['VENCIDO', 'DANADO', 'SE_CAYO', 'OTRO'] as const;
export type MotivoMermaProducto = (typeof MOTIVOS_MERMA_PRODUCTO)[number];
export const ETIQUETA_MOTIVO_MERMA: Record<MotivoMermaProducto, string> = {
  VENCIDO: 'Vencido',
  DANADO: 'Dañado',
  SE_CAYO: 'Se cayó',
  OTRO: 'Otro',
};

/** Lo producido hoy (suma de «Produje hoy») de un producto entero o de un sabor. */
export async function producidoHoyDe(db: any, productoId: bigint, saborId: bigint | null, fecha: string = fechaLimaHoy()) {
  const movs = await db.movimientoStock.findMany({
    where: {
      tipo: 'ENTRADA',
      nota: NOTA_PRODUCE_HOY,
      producto_id: productoId,
      sabor_id: saborId,
      en: { gte: new Date(`${fecha}T05:00:00.000Z`) }, // medianoche de Lima (UTC-5, sin horario de verano)
    },
    select: { cantidad: true },
  });
  return movs.reduce((acc: number, m: any) => acc + Number(m.cantidad), 0);
}

/**
 * Apertura con arrastre. `quedaron` es lo que quedó de ayer (corrige el saldo si se contó distinto) y `produccion`
 * se SUMA como «Produje hoy». El saldo nunca se reinicia: si ya hubo producción hoy, se conserva.
 */
export async function registrarAperturaArrastre(
  db: any,
  c: {
    productoId: bigint;
    saborId: bigint | null;
    quedaron: number;
    produccion: number;
    areaId: bigint | null | undefined;
    por: bigint;
    ahora: Date;
    fecha: string;
  },
) {
  const previa = await producidoHoyDe(db, c.productoId, c.saborId, c.fecha);
  const objetivo = c.quedaron + previa;
  if (c.saborId) await fijarAperturaSabor(db, c.productoId, c.saborId, objetivo, c.areaId, c.por, c.ahora, c.fecha);
  else await fijarAperturaProducto(db, c.productoId, objetivo, c.areaId, c.por, c.ahora, c.fecha);
  if (c.produccion <= 0) return;

  const lugarId = await lugarDelProducto(db, c.productoId, c.areaId);
  if (!lugarId) return;
  const cantidad = new Prisma.Decimal(c.produccion);
  if (c.saborId) {
    await db.stockSabor.upsert({
      where: { sabor_id: c.saborId },
      update: { cantidad: { increment: cantidad } },
      create: { sabor_id: c.saborId, cantidad },
    });
  } else {
    const fila = await db.stock.findFirst({ where: { producto_id: c.productoId, lugar_id: lugarId } });
    if (fila) await db.stock.update({ where: { id: fila.id }, data: { cantidad: { increment: cantidad } } });
    else await db.stock.create({ data: { producto_id: c.productoId, lugar_id: lugarId, cantidad } });
  }
  await db.movimientoStock.create({
    data: {
      tipo: 'ENTRADA',
      producto_id: c.productoId,
      sabor_id: c.saborId,
      lugar_id: lugarId,
      cantidad,
      por: c.por,
      nota: NOTA_PRODUCE_HOY,
    },
  });
  await db.conteoApertura.updateMany({
    where: { fecha: fechaColumna(c.fecha), producto_id: c.productoId, sabor_id: c.saborId },
    data: { cantidad: { increment: cantidad }, en: c.ahora },
  });
  if (c.saborId) await sincronizarAgotadoSabor(db, c.saborId, await saldoSabor(db, c.saborId), c.ahora, c.por);
  else await sincronizarAgotadoProducto(db, c.productoId, await saldoProducto(db, c.productoId), c.ahora);
}

/**
 * Merma de producto terminado (o de un sabor): descuenta del saldo y deja MERMA en movimiento_stock con quién y cuándo.
 * No mira el interruptor «Control de almacén» ni pide código de supervisor. Más que el saldo → 409 STOCK_INSUFICIENTE.
 */
export async function mermarProductoControlado(
  db: any,
  c: {
    productoId: bigint;
    nombre: string;
    saborId: bigint | null;
    saborNombre?: string | null;
    cantidad: number;
    motivo: MotivoMermaProducto;
    nota?: string | null;
    areaId: bigint | null | undefined;
    por: bigint;
    ahora: Date;
    fecha: string;
  },
): Promise<{ movimientoId: bigint; saldo: number }> {
  const etiqueta = ETIQUETA_MOTIVO_MERMA[c.motivo];
  const cant = new Prisma.Decimal(c.cantidad);
  const lugarId = await lugarDelProducto(db, c.productoId, c.areaId);
  if (!lugarId) throw new BadRequestException({ codigo: 'SIN_LUGAR_STOCK', mensaje: `No hay dónde descontar ${c.nombre}` });
  const etiquetaItem = c.saborNombre ? `${c.nombre} · ${c.saborNombre}` : c.nombre;

  const saldoActual = c.saborId ? await saldoSabor(db, c.saborId) : await saldoProducto(db, c.productoId);
  const insuficiente = () =>
    new ConflictException({
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: `Solo quedan ${Math.max(0, Math.floor(saldoActual))} de ${etiquetaItem}`,
      productoId: c.productoId.toString(),
      quedan: Math.max(0, Math.floor(saldoActual)),
    });
  if (c.cantidad > saldoActual) throw insuficiente();

  if (c.saborId) {
    const r = await db.stockSabor.updateMany({
      where: { sabor_id: c.saborId, cantidad: { gte: cant } },
      data: { cantidad: { decrement: cant } },
    });
    if (r.count === 0) throw insuficiente();
  } else {
    const r = await db.stock.updateMany({
      where: { producto_id: c.productoId, lugar_id: lugarId, cantidad: { gte: cant } },
      data: { cantidad: { decrement: cant } },
    });
    if (r.count === 0) throw insuficiente();
  }

  const mov = await db.movimientoStock.create({
    data: {
      tipo: 'MERMA',
      producto_id: c.productoId,
      sabor_id: c.saborId,
      lugar_id: lugarId,
      cantidad: cant.negated(),
      por: c.por,
      nota: `Merma · ${etiqueta}${c.nota?.trim() ? ` · ${c.nota.trim()}` : ''}`,
    },
  });

  const saldo = c.saborId ? await saldoSabor(db, c.saborId) : await saldoProducto(db, c.productoId);
  if (saldo <= 0) {
    if (c.saborId) await sincronizarAgotadoSabor(db, c.saborId, saldo, c.ahora, c.por);
    else await sincronizarAgotadoProducto(db, c.productoId, saldo, c.ahora);
  }
  return { movimientoId: mov.id, saldo };
}
