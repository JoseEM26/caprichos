import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { almacenConsumirAlPreparar, almacenPermitirCocinaNegativa, controlAlmacenActivo, insumosDeLinea } from '../stock';
import {
  consumoRealConMerma,
  lugarCocina,
  moverInsumo,
  redondear3,
  registrarPendiente,
  reducirPendientes,
  type Tx,
} from './stock-cocina';

const ESTADOS_ANULADOS = ['ANULADO', 'RECHAZADO'];
const BOT = BigInt(1);

/**
 * Recetas aplicables a un sabor: la de (producto, tamaño, SABOR) si existe; si no, la general (sabor vacío) del mismo tamaño.
 * Devuelve la lista por tamaño que espera `insumosDeLinea`.
 */
export function recetasDelSabor(recetas: any[], saborId: bigint | null): any[] {
  const generales = recetas.filter((r) => r.sabor_id == null);
  if (saborId == null) return generales;
  const porTamano = new Map<string, any>(generales.map((r) => [String(r.tamano_valor_id ?? 'null'), r]));
  for (const r of recetas) if (r.sabor_id === saborId && r.lineas?.length) porTamano.set(String(r.tamano_valor_id ?? 'null'), r);
  return [...porTamano.values()];
}

export interface FaltanteTanda {
  insumo: string;
  unidad: string;
  requiere: number;
  hay: number;
}

/**
 * Consumo de insumos por receta desde el stock de COCINA (Salados / lugar del área). Todo detrás del interruptor
 * «Control de almacén»: apagado, ningún método de aquí lee ni escribe más que el parámetro del interruptor.
 *
 * - Sobre pedido: se reconcilia contra `pedido_linea.listas` (unidades que Cocina marcó preparadas). Lo consumido se
 *   guarda en `consumo_linea.unidades`; la diferencia es lo que se descuenta o se devuelve, así marcar, desmarcar o
 *   despejar varias veces nunca duplica. Al anular, el dueño decide: MERMA (queda consumido) o DEVOLVER.
 * - Por tanda: consume insumos de la receta × (unidades ÷ rinde) al registrar la tanda; se revierte al anularla.
 * - Si Cocina no alcanza: el stock queda en negativo y se abre un pendiente de emitir de Almacén.
 */
@Injectable()
export class ConsumoRecetaService {
  private readonly logger = new Logger(ConsumoRecetaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  /** ¿Control de almacén encendido? Es la ÚNICA consulta que hace el sistema con el almacén apagado. */
  activo(): Promise<boolean> {
    return controlAlmacenActivo(this.prisma);
  }

  /** null = almacén apagado (usar el flujo de siempre); si no, cómo tratar un faltante en Cocina. */
  async modoTanda(): Promise<null | { permitirNegativa: boolean }> {
    if (!(await this.activo())) return null;
    return { permitirNegativa: await almacenPermitirCocinaNegativa(this.prisma) };
  }

  // ===========================================================================
  // SOBRE PEDIDO (productos de la carta: club sándwich, etc.)
  // ===========================================================================

  /**
   * Gancho de Cocina y de las anulaciones. NUNCA lanza: si algo falla se registra (log + auditoría) y se reintenta
   * en el siguiente evento del pedido (marcar, despejar, despachar) o con `reintentarPedido`, porque la cocina no
   * puede detenerse. Con almacén apagado, o con «consumir al preparar» en «no», no hace nada.
   */
  async reconciliarPedido(pedidoId: bigint | string | number, por?: bigint, devolverTodo = false): Promise<void> {
    try {
      await this.reconciliar(BigInt(pedidoId), por ?? BOT, devolverTodo);
    } catch (e: any) {
      this.logger.error(`Consumo por receta del pedido ${pedidoId}: ${e?.message}`, e?.stack);
      try {
        await this.auditoria.registrar({
          categoria: 'CAMBIO',
          modulo: 'almacen',
          accion: 'CONSUMO_RECETA_FALLO',
          resultado: 'RECHAZADO',
          entidad: 'pedido',
          entidadId: BigInt(pedidoId),
          motivo: String(e?.message ?? e).slice(0, 300),
          partyId: por,
        });
      } catch {
        /* el registro del fallo tampoco puede detener la cocina */
      }
    }
  }

  /**
   * ¿Corresponde preguntar al anular «¿se llegó a preparar?»? Solo con el almacén encendido y si el pedido ya tuvo consumo.
   * Con el almacén apagado no consulta nada más.
   */
  async tieneConsumo(pedidoId: bigint | string | number): Promise<boolean> {
    try {
      if (!(await this.activo())) return false;
      const lineas = await this.prisma.pedidoLinea.findMany({ where: { pedido_id: BigInt(pedidoId) }, select: { id: true } });
      if (lineas.length === 0) return false;
      const c = await this.prisma.consumoLinea.findFirst({ where: { pedido_linea_id: { in: lineas.map((l) => l.id) }, unidades: { gt: 0 } }, select: { pedido_linea_id: true } });
      return !!c;
    } catch {
      return false;
    }
  }

  /**
   * Decisión al anular un pedido que ya tuvo consumo (nunca lanza). DEVOLVER: nunca se llegó a preparar, los insumos
   * vuelven a Cocina con movimientos opuestos. MERMA (por defecto): se llegó a preparar, lo descontado queda como
   * pérdida y se deja constancia con el motivo.
   */
  async decidirAnulacion(pedidoId: bigint | string | number, decision: 'MERMA' | 'DEVOLVER' | undefined, motivo: string | undefined, por?: bigint): Promise<void> {
    try {
      if (!(await this.tieneConsumo(pedidoId))) return;
      if (decision === 'DEVOLVER') {
        await this.reconciliarPedido(pedidoId, por, true);
        return;
      }
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'almacen', accion: 'CONSUMO_RECETA_MERMA', entidad: 'pedido', entidadId: BigInt(pedidoId),
        motivo: (motivo ?? 'Pedido anulado').slice(0, 300), despues: { decision: 'MERMA' }, partyId: por,
      });
    } catch (e: any) {
      this.logger.error(`Decisión de anulación del pedido ${pedidoId}: ${e?.message}`);
    }
  }

  /** Reintento manual (Almacén/Admin) de un pedido cuyo consumo falló. */
  async reintentarPedido(pedidoId: bigint | string | number, por?: bigint) {
    await this.reconciliarPedido(pedidoId, por);
    const pid = BigInt(pedidoId);
    const lineas = await this.prisma.pedidoLinea.findMany({ where: { pedido_id: pid, producto_id: { not: null } }, select: { id: true, listas: true } });
    const consumos = await this.prisma.consumoLinea.findMany({ where: { pedido_linea_id: { in: lineas.map((l) => l.id) } } });
    const mapa = new Map(consumos.map((c) => [c.pedido_linea_id.toString(), c.unidades]));
    return { ok: true, pedidoId: pid.toString(), lineas: lineas.map((l) => ({ lineaId: l.id.toString(), listas: l.listas, consumidas: mapa.get(l.id.toString()) ?? 0 })) };
  }

  private async reconciliar(pid: bigint, por: bigint, devolverTodo = false): Promise<void> {
    if (!(await this.activo())) return;
    if (!(await almacenConsumirAlPreparar(this.prisma))) return;

    const pedido = await this.prisma.pedido.findUnique({ where: { id: pid }, select: { id: true, estado: true } });
    if (!pedido) return;
    const anulado = ESTADOS_ANULADOS.includes(pedido.estado);
    // Un pedido anulado no mueve stock solo: lo preparado queda como merma salvo que se pida devolverlo
    if (anulado && !devolverTodo) return;
    const objetivo = (l: { listas: number; cantidad: number }) => (devolverTodo ? 0 : Math.min(l.listas, l.cantidad));

    const lineas = await this.prisma.pedidoLinea.findMany({
      where: { pedido_id: pid, producto_id: { not: null } },
      select: {
        id: true, producto_id: true, tamano: true, cantidad: true, listas: true, despachadas: true, area_id: true,
        opcionesElegidas: { select: { opcion_id: true } },
      },
    });
    if (lineas.length === 0) return;
    const consumos = await this.prisma.consumoLinea.findMany({ where: { pedido_linea_id: { in: lineas.map((l) => l.id) } } });
    const consumido = new Map(consumos.map((c) => [c.pedido_linea_id.toString(), c.unidades]));
    const candidatas = lineas.filter((l) => objetivo(l) !== (consumido.get(l.id.toString()) ?? 0));
    if (candidatas.length === 0) return;

    // Un cobro ya descontó estos insumos con el método anterior: no se descuentan otra vez
    const previo = await this.prisma.movimientoStock.findFirst({
      where: { pedido_id: pid, tipo: 'VENTA', insumo_id: { not: null }, movimientosRevertidos: { none: {} } },
      select: { id: true },
    });
    if (previo) return;

    // Una sola consulta por tipo de dato (sin N+1)
    const productoIds = [...new Set(candidatas.map((l) => l.producto_id!))];
    const recetas = await this.prisma.receta.findMany({
      where: { producto_id: { in: productoIds }, es_produccion: false },
      include: { lineas: { include: { insumo: true } } },
    });
    const conReceta = new Set(recetas.filter((r) => r.lineas.length > 0).map((r) => r.producto_id.toString()));
    const aProcesar = candidatas.filter((l) => conReceta.has(l.producto_id!.toString()));
    if (aProcesar.length === 0) return;

    const opcionIds = [...new Set(aProcesar.flatMap((l) => l.opcionesElegidas.map((o) => o.opcion_id).filter((x): x is bigint => x != null)))];
    const ajustes = opcionIds.length ? await this.prisma.ajusteOpcion.findMany({ where: { opcion_id: { in: opcionIds } } }) : [];
    const tamanos = await this.prisma.productoTamano.findMany({
      where: { producto_id: { in: productoIds } },
      include: { tamano_valor: true },
    });
    const sabores = await this.prisma.sabor.findMany({ where: { producto_id: { in: productoIds } }, select: { id: true, producto_id: true, nombre: true } });
    const ctx = { recetas, ajustes, tamanos, sabores, insumos: new Map<string, any>() };
    for (const r of recetas) for (const l of r.lineas) ctx.insumos.set(l.insumo_id.toString(), l.insumo);
    const faltan = [...new Set(ajustes.map((a) => a.insumo_id.toString()))].filter((id) => !ctx.insumos.has(id));
    if (faltan.length) for (const i of await this.prisma.insumo.findMany({ where: { id: { in: faltan.map((x) => BigInt(x)) } } })) ctx.insumos.set(i.id.toString(), i);

    let fallo: any = null;
    let cambio = false;
    for (const l of aProcesar) {
      try {
        const hizo = await this.prisma.$transaction((tx) => this.aplicarLinea(tx, pid, l.id, ctx, por, devolverTodo));
        cambio = cambio || hizo;
      } catch (e) {
        fallo = e; // una línea que falla no frena a las demás
        this.logger.error(`Consumo por receta de la línea ${l.id}: ${(e as any)?.message}`);
      }
    }
    if (cambio) this.eventosGateway?.emitirAdmin('stock:cambio', {});
    if (fallo) throw fallo;
  }

  /** Reconcilia UNA línea dentro de su propia transacción (con la fila de la línea bloqueada). Devuelve si movió stock. */
  private async aplicarLinea(tx: Tx, pedidoId: bigint, lineaId: bigint, ctx: any, por: bigint, devolverTodo: boolean): Promise<boolean> {
    await tx.$queryRaw`SELECT id FROM pedido_linea WHERE id = ${lineaId} FOR UPDATE`;
    const linea = await tx.pedidoLinea.findUnique({
      where: { id: lineaId },
      select: { producto_id: true, tamano: true, sabor: true, cantidad: true, listas: true, despachadas: true, area_id: true, opcionesElegidas: { select: { opcion_id: true } }, sabores: { select: { sabor_id: true, sabor_nombre: true, cantidad: true } } },
    });
    const ped = await tx.pedido.findUnique({ where: { id: pedidoId }, select: { estado: true } });
    if (!linea || !ped || !linea.producto_id) return false;
    const anulado = ESTADOS_ANULADOS.includes(ped.estado);
    if (anulado && !devolverTodo) return false;
    const objetivo = devolverTodo ? 0 : Math.min(linea.listas, linea.cantidad);
    const fila = await tx.consumoLinea.findUnique({ where: { pedido_linea_id: lineaId } });
    const actual = fila?.unidades ?? 0;
    const delta = objetivo - actual;
    if (delta === 0) return false;

    const nota = (txt: string) => `${txt} · pedido ${pedidoId} · línea ${lineaId}`;
    let movio = false;

    if (delta > 0) {
      const items = this.insumosDeLaLinea(linea, delta, ctx);
      const lugarId = (await lugarCocina(tx)).id;
      for (const it of items.sort((a, b) => (a.insumo.id < b.insumo.id ? -1 : 1))) {
        const { antes } = await moverInsumo(tx, {
          insumoId: it.insumo.id, lugarId, delta: -it.cantidad, tipo: 'CONSUMO_RECETA', por,
          pedidoId, lineaId, nota: nota(`Preparado ×${delta}`),
        });
        // Lo que Cocina no tenía es lo que le debe a Almacén
        await registrarPendiente(tx, {
          insumoId: it.insumo.id, lugarId, faltante: redondear3(it.cantidad - Math.max(antes, 0)),
          origen: { tipo: 'LINEA', pedidoId, lineaId }, nota: nota('Faltante al preparar'),
        });
        movio = true;
      }
    } else if (actual > 0) {
      // Se devuelve la parte proporcional de lo que de verdad se descontó (aunque la receta haya cambiado después)
      const movs = await tx.movimientoStock.findMany({
        where: { pedido_linea_id: lineaId, tipo: 'CONSUMO_RECETA', insumo_id: { not: null } },
        select: { insumo_id: true, lugar_id: true, cantidad: true },
      });
      const neto = new Map<string, { insumoId: bigint; lugarId: bigint; consumido: number }>();
      for (const m of movs) {
        const k = `${m.insumo_id}|${m.lugar_id}`;
        const e = neto.get(k) ?? { insumoId: m.insumo_id!, lugarId: m.lugar_id, consumido: 0 };
        e.consumido = redondear3(e.consumido - Number(m.cantidad));
        neto.set(k, e);
      }
      const fraccion = Math.min(1, -delta / actual);
      for (const e of [...neto.values()].sort((a, b) => (a.insumoId < b.insumoId ? -1 : 1))) {
        const devolver = objetivo === 0 ? e.consumido : redondear3(e.consumido * fraccion);
        if (devolver <= 0) continue;
        await moverInsumo(tx, {
          insumoId: e.insumoId, lugarId: e.lugarId, delta: devolver, tipo: 'CONSUMO_RECETA', por,
          pedidoId, lineaId, nota: nota(`Devuelto ×${-delta} (${devolverTodo ? 'pedido anulado: nunca se preparó' : 'se deshizo lo preparado'})`),
        });
        await reducirPendientes(tx, { insumoId: e.insumoId, devuelto: devolver, origen: { tipo: 'LINEA', lineaId }, por });
        movio = true;
      }
    }

    await tx.consumoLinea.upsert({
      where: { pedido_linea_id: lineaId },
      update: { unidades: objetivo, actualizado_en: new Date() },
      create: { pedido_linea_id: lineaId, unidades: objetivo },
    });
    return movio;
  }

  /**
   * Insumos (en unidad de almacén) de `unidades` de una línea: receta del tamaño (y del sabor, si la hay) + ajustes de
   * sus opciones, ÷ factor de receta, ÷ (1 − merma habitual del insumo). Con sabores repartidos, cada sabor aporta su parte.
   */
  private insumosDeLaLinea(linea: any, unidades: number, ctx: any): Array<{ insumo: any; cantidad: number }> {
    let tamanoValorId: bigint | null = null;
    if (linea.tamano) {
      const pt = ctx.tamanos.find((t: any) => t.producto_id === linea.producto_id && t.tamano_valor?.nombre === linea.tamano);
      if (pt) tamanoValorId = pt.tamano_valor_id;
    }
    const opcionIds = linea.opcionesElegidas.map((o: any) => o.opcion_id).filter(Boolean);
    const neto = new Map<string, number>();
    for (const parte of this.partesPorSabor(linea, ctx)) {
      const recetas = recetasDelSabor(ctx.recetas.filter((r: any) => r.producto_id === linea.producto_id), parte.saborId);
      for (const c of insumosDeLinea(recetas, ctx.ajustes, tamanoValorId, opcionIds, unidades * parte.parte)) {
        neto.set(c.insumoId, (neto.get(c.insumoId) ?? 0) + c.cantidad);
      }
    }
    const salida: Array<{ insumo: any; cantidad: number }> = [];
    for (const [insumoId, enReceta] of neto) {
      const insumo = ctx.insumos.get(insumoId);
      if (!insumo) continue;
      const cantidad = consumoRealConMerma(enReceta / (Number(insumo.factor_receta) || 1), insumo.merma_pct);
      if (cantidad > 0) salida.push({ insumo, cantidad });
    }
    return salida;
  }

  /** Reparto de la línea por sabor: [{sabor, parte 0..1}]. Sin sabores conocidos = una sola parte con la receta general. */
  private partesPorSabor(linea: any, ctx: any): Array<{ saborId: bigint | null; parte: number }> {
    const deProducto = (ctx.sabores as any[]).filter((s) => s.producto_id === linea.producto_id);
    const filas: Array<{ saborId: bigint | null; peso: number }> = [];
    for (const f of linea.sabores ?? []) {
      const id = f.sabor_id ?? deProducto.find((s) => s.nombre === f.sabor_nombre)?.id ?? null;
      filas.push({ saborId: id, peso: Number(f.cantidad) || 0 });
    }
    if (filas.length === 0 && linea.sabor) {
      const s = deProducto.find((x) => x.nombre === linea.sabor);
      if (s) filas.push({ saborId: s.id, peso: 1 });
    }
    const total = filas.reduce((a, f) => a + f.peso, 0);
    if (total <= 0) return [{ saborId: null, parte: 1 }];
    return filas.filter((f) => f.peso > 0).map((f) => ({ saborId: f.saborId, parte: f.peso / total }));
  }

  // ===========================================================================
  // PRODUCCIÓN POR TANDA (donas, galletas)
  // ===========================================================================

  /** Receta de la tanda para un sabor: la de (producto, tamaño, sabor) si existe; si no, la general que se eligió. */
  async recetaDeTanda(receta: any, saborId: bigint | null): Promise<any> {
    if (!saborId) return receta;
    const r = await this.prisma.receta.findFirst({
      where: { producto_id: receta.producto_id, es_produccion: true, tamano_valor_id: receta.tamano_valor_id ?? null, sabor_id: saborId },
      include: { producto: true, lineas: { include: { insumo: true } } },
    });
    return r && r.lineas.length > 0 ? r : receta;
  }

  /** Insumos de una tanda en unidad de almacén: cantidad neta × (unidades ÷ rinde) ÷ factor_receta ÷ (1 − merma del insumo). */
  insumosDeTanda(receta: any, unidades: number): Array<{ insumo: any; cantidad: number }> {
    const rinde = Number(receta.rinde) > 0 ? Number(receta.rinde) : 1;
    return (receta.lineas ?? []).map((l: any) => {
      const enReceta = Number(l.cantidad) * (unidades / rinde);
      return { insumo: l.insumo, cantidad: consumoRealConMerma(enReceta / (Number(l.insumo.factor_receta) || 1), l.insumo.merma_pct) };
    });
  }

  /** Lo que Cocina no alcanza a cubrir para la tanda (solo se usa con «permitir cocina negativa» en «no»). */
  async faltantesTanda(receta: any, unidades: number): Promise<FaltanteTanda[]> {
    const cocina = await lugarCocina(this.prisma);
    const salida: FaltanteTanda[] = [];
    for (const it of this.insumosDeTanda(receta, unidades)) {
      const st = await this.prisma.stock.findFirst({ where: { insumo_id: it.insumo.id, lugar_id: cocina.id } });
      const hay = st ? Number(st.cantidad) : 0;
      if (hay < it.cantidad) salida.push({ insumo: it.insumo.nombre, unidad: it.insumo.unidad_almacen, requiere: it.cantidad, hay });
    }
    return salida;
  }

  /** Dentro de la transacción de la tanda: descuenta de Cocina (puede quedar negativo) y abre pendientes por el faltante. */
  async consumirTanda(tx: Tx, receta: any, unidades: number, produccionId: bigint, por: bigint): Promise<void> {
    const cocina = await lugarCocina(tx);
    const items = this.insumosDeTanda(receta, unidades).sort((a, b) => (a.insumo.id < b.insumo.id ? -1 : 1));
    for (const it of items) {
      if (it.cantidad <= 0) continue;
      const { antes } = await moverInsumo(tx, {
        insumoId: it.insumo.id, lugarId: cocina.id, delta: -it.cantidad, tipo: 'PRODUCCION_CONSUMO', por, produccionId,
        nota: `Producción de ${receta.producto?.nombre ?? 'producto'} (${unidades} unidades) · PRD-${produccionId}`,
      });
      await registrarPendiente(tx, {
        insumoId: it.insumo.id, lugarId: cocina.id, faltante: redondear3(it.cantidad - Math.max(antes, 0)),
        origen: { tipo: 'TANDA', produccionId }, nota: `Faltante en la tanda PRD-${produccionId}`,
      });
    }
  }

  /** Devuelve a Cocina lo que consumió la tanda (según sus movimientos) y baja sus pendientes. false = es una tanda anterior: usar el flujo de siempre. */
  async revertirTanda(tx: Tx, produccionId: bigint, por: bigint): Promise<boolean> {
    const movs = await tx.movimientoStock.findMany({
      where: { produccion_id: produccionId, tipo: 'PRODUCCION_CONSUMO', insumo_id: { not: null } },
      select: { insumo_id: true, lugar_id: true, cantidad: true },
    });
    if (movs.length === 0) return false;
    for (const m of [...movs].sort((a, b) => (a.insumo_id! < b.insumo_id! ? -1 : 1))) {
      const devolver = redondear3(-Number(m.cantidad));
      if (devolver <= 0) continue;
      await moverInsumo(tx, {
        insumoId: m.insumo_id!, lugarId: m.lugar_id, delta: devolver, tipo: 'ANULACION', por, produccionId,
        nota: `Devolución insumo por anulación PRD-${produccionId}`,
      });
      await reducirPendientes(tx, { insumoId: m.insumo_id!, devuelto: devolver, origen: { tipo: 'TANDA', produccionId }, por });
    }
    return true;
  }
}

export { Prisma };
