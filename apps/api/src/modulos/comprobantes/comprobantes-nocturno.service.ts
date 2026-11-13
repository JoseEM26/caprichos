import { ConflictException, Injectable, Logger, NotFoundException, Optional, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ComprobantesService } from './comprobantes.service';
import { enmascararDni, formatearCorrelativo, validarDocumentoComprobante } from './comprobantes.util';
import { siguienteCorrelativo } from './secuencia';
import { fechaIsoLima } from './sunat/sunat.util';
import { horaMinutoLima } from './comprobantes-sunat.service';
import { minutosDelDia } from './facturacion/facturacion.config';

export interface CambioComprobanteEntrada {
  tipo: 'SIMPLE' | 'BOLETA' | 'FACTURA';
  doc?: string | null;
  razon?: string | null;
  direccion?: string | null;
  motivo: string;
}

/**
 * Envío nocturno de boletas y facturas y cambio de comprobante de un pedido ya cobrado.
 *
 * Al cobrar, la boleta/factura queda POR_EMITIR_NOCHE sin serie ni número. El lote de la noche (desde facturacion_hora_envio,
 * hora de Lima, antes del resumen diario de boletas de las 23:30) aplica el cambio pendiente, asigna serie y correlativo y
 * la manda por el camino de siempre (boleta: firmada y al resumen diario; factura: sendBill). Así un cambio del mismo día
 * no deja huecos de numeración ni números quemados.
 * Supuesto (a confirmar con el contador): emitir en la misma noche cumple el envío dentro del día; la fecha de emisión es la de la venta.
 */
@Injectable()
export class ComprobantesNocturnoService {
  private readonly logger = new Logger(ComprobantesNocturnoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly comprobantes: ComprobantesService,
    @Optional() private readonly auditoria?: AuditoriaService,
  ) {}

  // ---- Cambio pedido por Caja o ADMIN (no emite nada: queda para la noche) ----

  async solicitarCambio(pedidoIdRaw: string, dto: CambioComprobanteEntrada, usuario?: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.id(pedidoIdRaw);
    const motivo = (dto.motivo ?? '').trim();
    if (motivo.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'El motivo es obligatorio y debe tener al menos 5 caracteres' });
    }
    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'El pedido no existe' });
    if (pedido.estado === 'ANULADO' || pedido.pago_estado !== 'PAGADO') {
      throw new ConflictException({ codigo: 'PEDIDO_NO_COBRADO', mensaje: 'Solo se cambia así el comprobante de un pedido cobrado y no anulado (antes de cobrar se cambia en el pedido)' });
    }
    const tipo = dto.tipo;
    const doc = tipo === 'SIMPLE' ? null : dto.doc?.trim() || null;
    const razon = tipo === 'FACTURA' ? dto.razon?.trim() || null : null;
    const direccion = tipo === 'FACTURA' ? dto.direccion?.trim() || null : null;
    const validacion = validarDocumentoComprobante(tipo, doc, razon, Number(pedido.total));
    if (!validacion.valido) {
      throw new BadRequestException({ codigo: 'COMPROBANTE_INVALIDO', mensaje: validacion.motivo });
    }
    if (tipo === pedido.comprobante_tipo && doc === (pedido.comprobante_doc ?? null) && razon === (pedido.comprobante_razon ?? null)) {
      throw new ConflictException({ codigo: 'SIN_CAMBIO', mensaje: 'Es el mismo comprobante que ya tiene el pedido' });
    }
    const datos = { tipo, documento: doc, razon_social: razon, direccion, motivo, solicitado_por: usuario?.partyId ? BigInt(usuario.partyId) : null, solicitado_en: new Date() };
    // Una fila por pedido: cambiar de nuevo el mismo día reemplaza al anterior
    const previo = await this.prisma.comprobanteCambioPendiente.findUnique({ where: { pedido_id: pedidoId } });
    await this.prisma.comprobanteCambioPendiente.upsert({ where: { pedido_id: pedidoId }, update: datos, create: { pedido_id: pedidoId, ...datos } });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'SOLICITAR_CAMBIO_COMPROBANTE',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo,
      antes: previo ? { pendiente: previo.tipo } : { tipo: pedido.comprobante_tipo, documento: pedido.comprobante_doc ? enmascararDni(pedido.comprobante_doc) : null },
      despues: { tipo, documento: doc ? enmascararDni(doc) : null, razon, reemplaza_pendiente: !!previo },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return this.leerCambio(pedidoId);
  }

  async deshacerCambio(pedidoIdRaw: string, usuario?: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.id(pedidoIdRaw);
    const previo = await this.prisma.comprobanteCambioPendiente.findUnique({ where: { pedido_id: pedidoId } });
    if (!previo) throw new NotFoundException({ codigo: 'SIN_CAMBIO_PENDIENTE', mensaje: 'El pedido no tiene un cambio de comprobante pendiente' });
    await this.prisma.comprobanteCambioPendiente.deleteMany({ where: { pedido_id: pedidoId } });
    await this.auditoria?.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'DESHACER_CAMBIO_COMPROBANTE',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      antes: { tipo: previo.tipo, documento: previo.documento ? enmascararDni(previo.documento) : null },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return { ok: true };
  }

  /** Cambio pendiente del pedido (documento enmascarado salvo para ADMIN), o null. */
  async leerCambio(pedidoIdRaw: bigint | string, usuario?: UsuarioAutenticado) {
    const c = await this.prisma.comprobanteCambioPendiente.findUnique({ where: { pedido_id: this.id(pedidoIdRaw) } });
    if (!c) return null;
    const admin = usuario?.rol === 'ADMIN';
    return {
      tipo: c.tipo,
      documento: admin ? c.documento : c.documento ? enmascararDni(c.documento) : null,
      razon_social: c.razon_social,
      motivo: c.motivo,
      solicitado_en: c.solicitado_en,
    };
  }

  // ---- Lote de la noche ----

  /**
   * Una pasada del lote. Idempotente: lo ya emitido no vuelve a salir (el reclamo es un UPDATE condicionado al estado) y
   * un cambio aplicado se borra. Lo que falla queda para la siguiente pasada o en «reintentar» como cualquier comprobante.
   * forzar = botón «Emitir ahora»: no espera la hora configurada.
   */
  async emitirLote(ahora = new Date(), forzar = false): Promise<{ cambios: number; emitidos: number; descartados: number }> {
    const cfg = await this.comprobantes.leerConfigFacturacion();
    const { h, m } = horaMinutoLima(ahora);
    const hoy = fechaIsoLima(ahora);
    const llegoLaHora = forzar || h * 60 + m >= minutosDelDia(cfg.horaEnvio);
    // Toca desde la hora configurada; lo de días anteriores (si el servidor estuvo caído) sale en cuanto se pueda
    const debido = (f: Date) => llegoLaHora || fechaIsoLima(f) < hoy;
    const r = { cambios: 0, emitidos: 0, descartados: 0 };

    const cambios = await this.prisma.comprobanteCambioPendiente.findMany({ orderBy: { solicitado_en: 'asc' }, take: 200 });
    for (const c of cambios) {
      if (!debido(c.solicitado_en)) continue;
      try {
        if (await this.aplicarCambio(c)) r.cambios++;
        else r.descartados++;
      } catch (e: any) {
        this.logger.error(`Cambio de comprobante del pedido ${c.pedido_id}: ${e?.message ?? e}`);
      }
    }

    const filas = await this.prisma.comprobante.findMany({
      where: { facturacion_estado: 'POR_EMITIR_NOCHE', anulado_en: null },
      orderBy: { id: 'asc' },
      take: 500,
      select: { id: true, creado_en: true },
    });
    for (const f of filas) {
      if (!debido(f.creado_en)) continue;
      try {
        if (await this.emitirFila(f.id)) r.emitidos++;
      } catch (e: any) {
        this.logger.error(`Emisión nocturna del comprobante ${f.id}: ${e?.message ?? e}`);
      }
    }
    return r;
  }

  /** Aplica un cambio pendiente. true = aplicado; false = descartado (el pedido ya no está cobrado o fue anulado). */
  private async aplicarCambio(c: any): Promise<boolean> {
    const pedidoId: bigint = c.pedido_id;
    const quitar = () => this.prisma.comprobanteCambioPendiente.deleteMany({ where: { pedido_id: pedidoId, solicitado_en: c.solicitado_en } });
    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido || pedido.estado === 'ANULADO' || pedido.pago_estado !== 'PAGADO') {
      await quitar();
      await this.auditar('DESCARTAR_CAMBIO_COMPROBANTE', pedidoId, c.motivo, { tipo: c.tipo }, { razon: 'pedido anulado o sin cobro' });
      return false;
    }
    const actual = await this.prisma.comprobante.findFirst({ where: { pedido_id: pedidoId, anulado_en: null, tipo: { in: ['BOLETA', 'FACTURA'] } } });
    const antes = { tipo: actual?.tipo ?? pedido.comprobante_tipo, numero: actual?.numero_texto ?? null, estado: actual?.facturacion_estado ?? null };
    let resultado: string;

    if (actual && actual.facturacion_estado === 'POR_EMITIR_NOCHE') {
      // Nunca salió ni tiene número: se reemplaza sin enviar nada (cero anulaciones)
      if (c.tipo === 'SIMPLE') {
        await this.prisma.comprobante.update({ where: { id: actual.id }, data: { anulado_en: new Date(), anulado_motivo: `Cambio de comprobante: ${c.motivo}` } });
      } else {
        await this.prisma.comprobante.update({ where: { id: actual.id }, data: { tipo: c.tipo, documento: c.documento, razon_social: c.razon_social } });
      }
      resultado = 'REEMPLAZADO_SIN_ENVIAR';
    } else if (actual) {
      // Ya había salido (p. ej. de antes del envío nocturno): una sola baja y el nuevo. La baja nunca lanza.
      await this.comprobantes.darDeBajaPorAnulacion(pedidoId, `Cambio de comprobante: ${c.motivo}`);
      resultado = 'BAJA_Y_NUEVO';
    } else {
      resultado = 'NUEVO';
    }

    await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { comprobante_tipo: c.tipo, comprobante_doc: c.documento, comprobante_razon: c.razon_social, comprobante_direccion: c.direccion },
    });
    if (c.tipo !== 'SIMPLE' && resultado !== 'REEMPLAZADO_SIN_ENVIAR') {
      // Fila nueva (queda POR_EMITIR_NOCHE y sale en esta misma pasada). Si falla, el cambio sigue pendiente.
      await this.comprobantes.emitirParaPedido(pedidoId);
    }
    await quitar();
    await this.auditar('APLICAR_CAMBIO_COMPROBANTE', pedidoId, c.motivo, antes, { tipo: c.tipo, resultado });
    return true;
  }

  /** Asigna serie y correlativo (atómico con el reclamo: sin huecos) y envía. true si salió del estado de espera. */
  private async emitirFila(id: bigint): Promise<boolean> {
    const fila = await this.prisma.comprobante.findUnique({ where: { id }, include: { pedido: true } });
    if (!fila || fila.facturacion_estado !== 'POR_EMITIR_NOCHE' || fila.anulado_en) return false;
    // Pedido anulado (o cobro deshecho) antes del envío: no hay nada que anular en SUNAT
    if (fila.pedido.estado === 'ANULADO' || fila.pedido.pago_estado !== 'PAGADO') {
      await this.prisma.comprobante.updateMany({
        where: { id, facturacion_estado: 'POR_EMITIR_NOCHE' },
        data: { anulado_en: new Date(), anulado_motivo: 'Pedido anulado antes del envío nocturno: no se emitió' },
      });
      return false;
    }
    const cfg = await this.comprobantes.leerConfigFacturacion();
    const proveedor = this.comprobantes.proveedorEfectivo(cfg.proveedor);
    const serie = fila.tipo === 'BOLETA' ? cfg.serieBoleta : cfg.serieFactura;
    const asignado = await this.prisma.$transaction(async (tx: any) => {
      const reclamo = await tx.comprobante.updateMany({
        where: { id, facturacion_estado: 'POR_EMITIR_NOCHE', anulado_en: null },
        data: { facturacion_estado: 'PENDIENTE_ENVIO' },
      });
      if (reclamo.count === 0) return false;
      const numero = await siguienteCorrelativo(tx, serie);
      await tx.comprobante.update({
        where: { id },
        data: { serie, numero, numero_texto: formatearCorrelativo(serie, numero), emisor: proveedor, simulado: proveedor === 'SIMULADO' },
      });
      return true;
    });
    if (!asignado) return false;
    await this.auditar('EMITIR_NOCTURNO', fila.pedido_id, null, { estado: 'POR_EMITIR_NOCHE' }, { tipo: fila.tipo, serie });
    // El número ya es suyo: si el envío falla queda PENDIENTE_ENVIO y el worker de reintentos lo reenvía
    await this.comprobantes.enviarElectronico(id, { automatico: true }).catch((e: any) => this.logger.warn(`Envío nocturno ${id}: ${e?.message ?? e}`));
    return true;
  }

  private async auditar(accion: string, pedidoId: bigint, motivo: string | null, antes: unknown, despues: unknown) {
    await this.auditoria
      ?.registrar({ categoria: 'CAMBIO', modulo: 'comprobantes', accion, resultado: 'OK', entidad: 'pedido', entidadId: pedidoId, motivo: motivo ?? undefined, antes: antes as any, despues: despues as any })
      .catch(() => undefined);
  }

  private id(raw: bigint | string): bigint {
    try {
      return BigInt(raw);
    } catch {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
  }
}
