import { HttpException, HttpStatus, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ResultadoEnvioWhatsApp, Ventana24hService, WHATSAPP_MENSAJERIA_PUERTO, WhatsAppMensajeriaPuerto, esErrorPermanente } from '../chatbot';
import { ArchivosService } from '../archivos';
import { textoDocumentoChat } from '../../comun/documentos-whatsapp.util';
import { ComprobantesService } from './comprobantes.service';
import {
  CLAVE_FACTURA_WHATSAPP,
  CLAVE_FACTURA_WHATSAPP_PLANTILLA,
  EstadoEnvioFactura,
  IDIOMA_PLANTILLA_FACTURA,
  celularParaFactura,
  esErrorVentana,
  esperaReintento,
  nombreArchivoFactura,
  plantillaValida,
  textoFactura,
} from './factura-whatsapp';

/** Cada cuánto el barrido busca envíos por reintentar. */
const BARRIDO_MS = 5 * 60_000;
/** Mientras un proceso trabaja un envío, nadie más lo toma por este tiempo. */
const ARRENDAMIENTO_MS = 10 * 60_000;

export interface ConfigFacturaWhatsapp {
  activo: boolean;
  plantilla: string;
}

export interface ResultadoProcesoFactura {
  estado: EstadoEnvioFactura;
  via: 'DOCUMENTO' | 'PLANTILLA' | null;
  detalle: string | null;
}

/**
 * Envía por WhatsApp (bot) el PDF de la FACTURA aceptada por SUNAT al celular del pedido. Un solo mensaje por factura:
 *  - ventana de 24 h abierta: documento libre con el PDF (media id);
 *  - ventana cerrada y plantilla configurada: plantilla con el PDF en el encabezado;
 *  - ventana cerrada y sin plantilla: «sin ventana»; se reintenta con espera creciente y luego se cierra.
 * Nunca bloquea ni cambia la emisión: corre aparte y todo fallo se registra.
 * ponytail: setInterval por proceso; con varias réplicas el arrendamiento (proximo_intento_en) evita el doble envío.
 */
@Injectable()
export class FacturaWhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacturaWhatsappService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly comprobantes: ComprobantesService,
    private readonly ventana: Ventana24hService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO) private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly archivos?: ArchivosService,
  ) {}

  onModuleInit() {
    this.comprobantes.alAceptarFactura = (id) => this.disparar(id);
    this.timer = setInterval(() => void this.barrer().catch((e) => this.logger.error(`Barrido de facturas por WhatsApp: ${e?.message ?? e}`)), BARRIDO_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.comprobantes.alAceptarFactura) this.comprobantes.alAceptarFactura = null;
    if (this.timer) clearInterval(this.timer);
  }

  // ---- Configuración (parámetros de sistema) ----

  async leerConfig(): Promise<ConfigFacturaWhatsapp> {
    try {
      const filas = await this.prisma.parametro.findMany({ where: { clave: { in: [CLAVE_FACTURA_WHATSAPP, CLAVE_FACTURA_WHATSAPP_PLANTILLA] } } });
      const v = (clave: string) => filas.find((f) => f.clave === clave)?.valor;
      return { activo: v(CLAVE_FACTURA_WHATSAPP) !== false, plantilla: plantillaValida(v(CLAVE_FACTURA_WHATSAPP_PLANTILLA)) };
    } catch {
      return { activo: true, plantilla: '' };
    }
  }

  async guardarConfig(activo: boolean, plantilla: string | undefined, usuario?: UsuarioAutenticado, ip?: string) {
    const antes = await this.leerConfig();
    const nueva = { activo, plantilla: plantilla === undefined ? antes.plantilla : plantillaValida(plantilla) };
    const guardar = (clave: string, valor: unknown) =>
      this.prisma.parametro.upsert({ where: { clave }, update: { valor: valor as any }, create: { clave, valor: valor as any } });
    await guardar(CLAVE_FACTURA_WHATSAPP, nueva.activo);
    await guardar(CLAVE_FACTURA_WHATSAPP_PLANTILLA, nueva.plantilla);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: 'CONFIG_FACTURA_WHATSAPP',
      resultado: 'OK',
      entidad: 'parametro',
      antes: { ...antes },
      despues: { ...nueva },
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      ip,
    });
    return nueva;
  }

  // ---- Disparo ----

  /**
   * Una factura acaba de ser aceptada por SUNAT. Crea la fila de envío (la clave única es la idempotencia: una transición
   * repetida no duplica) y procesa aparte, sin esperar. Nunca lanza.
   */
  disparar(comprobanteId: bigint): void {
    setImmediate(() => {
      void this.iniciar(comprobanteId).catch((e) => this.logger.error(`Factura por WhatsApp (${comprobanteId}): ${e?.message ?? e}`));
    });
  }

  async iniciar(comprobanteId: bigint): Promise<ResultadoProcesoFactura | null> {
    const c = await this.prisma.comprobante.findUnique({ where: { id: comprobanteId }, select: { tipo: true, facturacion_estado: true, simulado: true } });
    if (!c || c.tipo !== 'FACTURA' || c.facturacion_estado !== 'EMITIDO_SUNAT' || c.simulado) return null;
    const r = await this.prisma.facturaWhatsappEnvio.createMany({
      data: [{ comprobante_id: comprobanteId, estado: 'PENDIENTE', proximo_intento_en: new Date(Date.now() + ARRENDAMIENTO_MS) }],
      skipDuplicates: true,
    });
    if (r.count === 0) return null; // ya se envió o se está enviando: no se duplica
    return this.procesar(comprobanteId, {});
  }

  /** Botón «Reenviar por WhatsApp»: mismo camino, respeta la ventana y el interruptor. Un envío más, a pedido de una persona. */
  async reenviar(idRaw: string, usuario: UsuarioAutenticado, ip?: string): Promise<ResultadoProcesoFactura> {
    let id: bigint;
    try {
      id = BigInt(idRaw);
    } catch {
      throw new HttpException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' }, HttpStatus.NOT_FOUND);
    }
    const c = await this.prisma.comprobante.findUnique({ where: { id }, select: { tipo: true, facturacion_estado: true, simulado: true, anulado_en: true } });
    if (!c) throw new HttpException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El comprobante no existe' }, HttpStatus.NOT_FOUND);
    if (c.tipo !== 'FACTURA' || c.facturacion_estado !== 'EMITIDO_SUNAT' || c.simulado || c.anulado_en) {
      throw new HttpException({ codigo: 'FACTURA_NO_ENVIABLE', mensaje: 'Solo se envía por WhatsApp una factura real aceptada por SUNAT y vigente' }, HttpStatus.CONFLICT);
    }
    if (!(await this.leerConfig()).activo) {
      throw new HttpException({ codigo: 'ENVIO_APAGADO', mensaje: 'El envío de facturas por WhatsApp está apagado en Configuración' }, HttpStatus.CONFLICT);
    }
    await this.prisma.facturaWhatsappEnvio.upsert({
      where: { comprobante_id: id },
      update: { estado: 'PENDIENTE', intentos: 0, proximo_intento_en: new Date(Date.now() + ARRENDAMIENTO_MS), actualizado_en: new Date() },
      create: { comprobante_id: id, estado: 'PENDIENTE', proximo_intento_en: new Date(Date.now() + ARRENDAMIENTO_MS) },
    });
    return this.procesar(id, { usuario, ip, manual: true });
  }

  /** Reintentos: envíos sin ventana o con error temporal cuya espera ya pasó, y los que quedaron a medias. */
  async barrer(ahora = new Date()): Promise<number> {
    const filas = await this.prisma.facturaWhatsappEnvio.findMany({
      where: { estado: { in: ['PENDIENTE', 'SIN_VENTANA', 'ERROR'] }, proximo_intento_en: { lte: ahora } },
      orderBy: { proximo_intento_en: 'asc' },
      take: 10,
    });
    let hechos = 0;
    for (const f of filas) {
      // Arrendamiento: solo un proceso toma la fila
      const r = await this.prisma.facturaWhatsappEnvio.updateMany({
        where: { comprobante_id: f.comprobante_id, proximo_intento_en: f.proximo_intento_en },
        data: { proximo_intento_en: new Date(ahora.getTime() + ARRENDAMIENTO_MS) },
      });
      if (r.count !== 1) continue;
      try {
        await this.procesar(f.comprobante_id, {});
        hechos++;
      } catch (e: any) {
        this.logger.error(`Factura por WhatsApp (${f.comprobante_id}): ${e?.message ?? e}`);
      }
    }
    return hechos;
  }

  // ---- Núcleo ----

  /** Decide y envía. Nunca toca el comprobante: solo su fila de envío. Un fallo inesperado queda como ERROR con reintento. */
  private async procesar(id: bigint, o: { usuario?: UsuarioAutenticado; ip?: string; manual?: boolean }): Promise<ResultadoProcesoFactura> {
    try {
      return await this.decidir(id, o);
    } catch (e: any) {
      this.logger.error(`Factura por WhatsApp (${id}): ${e?.message ?? e}`);
      return this.cerrar(id, 'ERROR', { detalle: 'EXCEPCION', reintentar: true }, o);
    }
  }

  private async decidir(id: bigint, o: { usuario?: UsuarioAutenticado; ip?: string; manual?: boolean }): Promise<ResultadoProcesoFactura> {
    const cfg = await this.leerConfig();
    if (!cfg.activo) return this.cerrar(id, 'APAGADO', { detalle: 'INTERRUPTOR_APAGADO' }, o);

    const c = await this.prisma.comprobante.findUnique({
      where: { id },
      include: { pedido: { select: { id: true, cliente_telefono: true, es_personal: true } } },
    });
    if (!c || c.tipo !== 'FACTURA' || c.facturacion_estado !== 'EMITIDO_SUNAT' || c.simulado) return this.cerrar(id, 'OMITIDO', { detalle: 'NO_ENVIABLE' }, o);
    if (c.anulado_en || c.baja_estado) return this.cerrar(id, 'OMITIDO', { detalle: 'ANULADA' }, o);
    if (c.pedido.es_personal) return this.cerrar(id, 'OMITIDO', { detalle: 'PERSONAL' }, o);

    const telefono = celularParaFactura(c.pedido.cliente_telefono);
    if (!telefono) return this.cerrar(id, 'SIN_CELULAR', { detalle: 'SIN_CELULAR' }, o);
    if (!(await this.ventana.tieneConsentimiento(telefono))) return this.cerrar(id, 'OMITIDO', { detalle: 'CLIENTE_BAJA' }, o);

    const abierta = await this.ventana.esVentanaAbierta(telefono);
    if (!abierta && !cfg.plantilla) return this.cerrar(id, 'SIN_VENTANA', { detalle: 'SIN_VENTANA', reintentar: true }, o);

    // El PDF se genera una vez y viaja a Meta por la Media API (nunca por link: da 131000)
    const pdf = await this.comprobantes.pdfParaEnvio(id);
    const nombre = nombreArchivoFactura(c.numero_texto as string);
    const conv = await this.prisma.conversacion.findUnique({ where: { telefono }, select: { id: true, phone_number_id: true } });
    const phoneNumberId = conv?.phone_number_id ?? undefined;
    const opciones = { pedidoId: c.pedido.id, ...(phoneNumberId ? { phoneNumberId } : {}), ...(conv ? { conversacionId: conv.id } : {}) };
    const mediaId = this.mensajeria.estaConectado().modo === 'meta' ? ((await this.mensajeria.subirMedia?.(pdf.contenido, 'application/pdf', phoneNumberId, nombre)) ?? null) : 'simulado';
    if (!mediaId) return this.cerrar(id, 'ERROR', { detalle: 'SUBIDA_MEDIA', reintentar: true }, o);

    const enPlantilla = () =>
      this.mensajeria.enviarPlantilla(telefono, cfg.plantilla, IDIOMA_PLANTILLA_FACTURA, [c.numero_texto as string], { ...opciones, documentoCabecera: { mediaId, nombre } });
    let via: 'DOCUMENTO' | 'PLANTILLA' = abierta ? 'DOCUMENTO' : 'PLANTILLA';
    let r: ResultadoEnvioWhatsApp = abierta
      ? await this.mensajeria.enviarDocumento(telefono, mediaId, nombre, textoFactura(c.numero_texto as string), opciones)
      : await enPlantilla();
    // La ventana se cerró entre la consulta y el envío (o Meta la cuenta por otro número): una sola vez con la plantilla
    if (!r.exito && abierta && cfg.plantilla && esErrorVentana(r.errorCodigo, r.errorDetalle)) {
      via = 'PLANTILLA';
      r = await enPlantilla();
    }

    if (r.exito) {
      await this.registrarEnChat(telefono, pdf.contenido, nombre, via, cfg.plantilla, r);
      return this.cerrar(id, 'ENVIADO', { via, detalle: via === 'PLANTILLA' ? 'PLANTILLA' : null }, o);
    }
    if (r.estado === 'OMITIDO') return this.cerrar(id, 'OMITIDO', { detalle: r.errorCodigo ?? 'OMITIDO' }, o);
    if (esErrorVentana(r.errorCodigo, r.errorDetalle)) return this.cerrar(id, 'SIN_VENTANA', { detalle: 'SIN_VENTANA', reintentar: true }, o);
    const codigo = String(r.errorCodigo ?? 'ERROR_ENVIO').slice(0, 60);
    return this.cerrar(id, 'ERROR', { detalle: codigo, reintentar: !esErrorPermanente(r.errorCodigo) }, o);
  }

  /** Deja el documento en el hilo del cliente como cualquier documento enviado (mensaje_chat DOCUMENTO). No rompe el envío si falla. */
  private async registrarEnChat(telefono: string, contenido: Buffer, nombre: string, via: string, plantilla: string, r: ResultadoEnvioWhatsApp): Promise<void> {
    try {
      if (!this.archivos) return;
      const guardado = await this.archivos.subirDocumento(contenido, 'application/pdf', nombre);
      const conversacion = await this.prisma.conversacion.upsert({
        where: { telefono },
        update: { ultima_actividad: new Date() },
        create: { telefono },
        select: { id: true },
      });
      await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: conversacion.id,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: 'DOCUMENTO',
          contenido: {
            texto: textoDocumentoChat(nombre, contenido.length),
            documento: { archivoId: guardado.id, nombre, mime: 'application/pdf', bytes: contenido.length },
            origen: 'FACTURA_WHATSAPP',
            ...(via === 'PLANTILLA' ? { plantilla } : {}),
            estado: r.estado,
          },
          meta_id: r.waMessageId ?? null,
          whatsapp_mensaje_id: r.id && /^\d+$/.test(r.id) ? BigInt(r.id) : null,
        },
      });
    } catch (e: any) {
      this.logger.warn(`La factura salió por WhatsApp pero no quedó en el hilo: ${e?.message ?? e}`);
    }
  }

  /** Guarda el resultado, programa el reintento si toca, audita y deja un log sin datos personales. */
  private async cerrar(
    id: bigint,
    estado: EstadoEnvioFactura,
    extra: { via?: 'DOCUMENTO' | 'PLANTILLA'; detalle?: string | null; reintentar?: boolean },
    o: { usuario?: UsuarioAutenticado; ip?: string; manual?: boolean },
  ): Promise<ResultadoProcesoFactura> {
    const previa = await this.prisma.facturaWhatsappEnvio.findUnique({ where: { comprobante_id: id }, select: { intentos: true } });
    const intentos = (previa?.intentos ?? 0) + 1;
    const espera = extra.reintentar ? esperaReintento(intentos) : null;
    const ahora = new Date();
    const detalle = extra.detalle ?? null;
    await this.prisma.facturaWhatsappEnvio.upsert({
      where: { comprobante_id: id },
      update: {
        estado,
        via: extra.via ?? null,
        intentos,
        detalle,
        proximo_intento_en: espera ? new Date(ahora.getTime() + espera) : null,
        ...(estado === 'ENVIADO' ? { enviado_en: ahora } : {}),
        actualizado_en: ahora,
      },
      create: { comprobante_id: id, estado, via: extra.via ?? null, intentos, detalle, proximo_intento_en: espera ? new Date(ahora.getTime() + espera) : null, ...(estado === 'ENVIADO' ? { enviado_en: ahora } : {}) },
    });
    this.logger.log(JSON.stringify({ evento: 'factura_whatsapp', comprobante: String(id), estado, via: extra.via ?? null, detalle, intento: intentos, reintento_en_min: espera ? Math.round(espera / 60_000) : null, manual: o.manual === true }));
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'comprobantes',
      accion: `FACTURA_WHATSAPP_${estado}`,
      resultado: estado === 'ENVIADO' || estado === 'APAGADO' || estado === 'SIN_CELULAR' || estado === 'OMITIDO' ? 'OK' : 'RECHAZADO',
      entidad: 'comprobante',
      entidadId: id,
      despues: { estado, via: extra.via ?? null, detalle, intento: intentos, manual: o.manual === true },
      partyId: o.usuario?.partyId ? BigInt(o.usuario.partyId) : undefined,
      ip: o.ip,
    });
    return { estado, via: extra.via ?? null, detalle };
  }
}
