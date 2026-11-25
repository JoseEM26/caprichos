import { BOTON_LISTA_MENU, FILAS_MENU_PRINCIPAL, TITULO_SECCION_MENU } from '../conversacion/textos-bot';
import { urlPublicaCarta } from './carrusel.util';
import { NumerosWhatsappService } from './numeros-whatsapp.service';
import { CANAL_WHATSAPP_BUSINESS } from '../utilidades/canal-whatsapp-business';
import { ejecutarEnSerie } from '../utilidades/candado-serie.util';
import { interactivoDesdeContenido } from './interactivo.util';
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { ArchivosService } from '../../archivos/archivos.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import {
  enmascararTelefono,
  hashTelefono,
  normalizarTelefono,
} from '../utilidades/enmascarar.util';
import { sanearDetalleMeta } from '../utilidades/meta-errores.util';
import {
  limpiarNombrePerfil,
  obtenerNombreMostrar,
} from '../../mensajes/utilidades/nombre-contacto.util';
import { VouchersService } from '../../vouchers/vouchers.service';
import { EjecutorConversacionService } from '../conversacion/ejecutor-conversacion.service';
import { ReprogramacionService } from './reprogramacion.service';
import { AvisosInternosService } from '../avisos-internos/avisos-internos.service';
import { anotarPagoEnFlujo } from './pago-para-persona.util';
import { enviarResumenPendienteDeCarta, telefonoDelChat } from './pedidos-del-chat.util';
import { pedidoEsperandoVoucher, SELECT_PEDIDO_VOUCHER, ultimos9 } from './pedido-esperando-voucher.util';
import { readFile } from 'fs/promises';
import { OutboxWhatsappService } from './outbox-whatsapp.service';
import { interpretarPuntajeEncuesta } from './encuesta-posventa.util';
import { plusCodeDesdeTexto } from '@caprichos/compartido';
import { ubicacionValida, UbicacionCliente } from './ubicacion-cliente.util';
import { ModuleRef } from '@nestjs/core';
import { UBICACION_PEDIDO_PUERTO, UbicacionPedidoPuerto } from '../puerto/ubicacion-pedido.puerto';
import { DireccionesService } from '../../direcciones/direcciones.service';
import {
  atenderMensajeVerificacion,
  atenderVerificacionSinNumero,
  claveParLidCelular,
  esMensajeVerificacion,
  PAR_LID_TTL_SEG,
  PuenteLid,
  RESPUESTA_NO_VERIFICADO,
  secretoVerificacion,
} from '../../clientes/verificacion-whatsapp.util';
import { WhatsAppEvolutionAdaptador } from '../adaptadores/whatsapp-evolution.adaptador';
import { textoGraciasEncuesta, textoPreguntaMotivo, TEXTO_PIDE_MOTIVO_LIBRE } from '../conversacion/textos-encuesta';
import { etiquetaMotivo, interpretarMotivoEncuesta, MOTIVO_TEXTO_MAX, MOTIVO_VENCE_MS } from './encuesta-motivo.util';
import { leerParametroNumerico } from '../../impresion/estado-impresion';
import {
  ClasificacionMensajeEntrante,
  clasificarMensajeEntrante,
} from '../utilidades/clasificar-mensaje-entrante.util';
import {
  ORIGEN_NO_COMPATIBLE,
  LIMITE_NO_COMPATIBLES_SEGUIDOS,
  MOTIVO_DERIVACION_NO_COMPATIBLES,
  VENTANA_AVISO_NO_COMPATIBLE_MS,
  armarTextoRepeticion,
  tipoChatNoCompatible,
  textoAvisoNoCompatible,
} from '../utilidades/no-compatibles.util';
import {
  MAX_DOCUMENTO_BYTES,
  MOTIVO_DERIVACION_DOCUMENTO,
  TEXTO_DOCUMENTO_NO_RECIBIDO,
  TEXTO_DOCUMENTO_RECIBIDO,
  TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO,
  TIPOS_DOCUMENTO_PERMITIDOS,
  contenidoCoincide,
  nombreSegunMime,
  textoDocumentoChat,
  validarDocumento,
} from '../../../comun/documentos-whatsapp.util';

import { EvolutionApiCliente } from '../evolution/evolution-api.cliente';
import { AutorespuestaWhatsappService } from './autorespuesta-whatsapp.service';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB
/** Notas de voz y audios: hasta 16 MB (Meta entrega las notas de voz como audio/ogg; codecs=opus). */
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
export const TIPOS_AUDIO_PERMITIDOS = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/amr', 'audio/aac'];
/** Una persona escucha siempre las notas de voz: el bot no las interpreta, avisa una vez y pasa el chat. */
export const TEXTO_NOTA_DE_VOZ = 'Recibí tu nota de voz 🎧; una persona del equipo la va a escuchar y te responde en breve';
export const MOTIVO_DERIVACION_NOTA_DE_VOZ = 'NOTA_DE_VOZ';
/** Imagen sin pedido esperando pago: la IA no la analiza; una persona la revisa (un solo aviso por ráfaga). */
export const TEXTO_IMAGEN_RECIBIDA = '¡Gracias! 💛 Recibimos tu imagen. Una persona del equipo la revisa y te escribe en un momento (si estamos cerrados, apenas abramos) 🥰';
export const MOTIVO_DERIVACION_IMAGEN = 'IMAGEN_RECIBIDA';
export const TIPOS_MEDIA_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

/** Numero de WhatsApp Business que recibio un evento (phone_number_id de Meta y numero para mostrar). */
export interface ReceptorWhatsapp {
  id: string;
  display?: string;
}

export { CANAL_WHATSAPP_BUSINESS };

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);
  private readonly verifyToken: string;
  private readonly appSecret: string;
  private readonly apiVersion: string;
  private readonly waToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    private readonly archivosService: ArchivosService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly motorConversacion?: EjecutorConversacionService,
    @Optional()
    @Inject(forwardRef(() => AvisosInternosService))
    private readonly avisosInternosService?: AvisosInternosService,
    @Optional()
    @Inject(forwardRef(() => VouchersService))
    private readonly vouchersService?: VouchersService,
    @Optional() private readonly reprogramacion?: ReprogramacionService,
    @Optional() private readonly outbox?: OutboxWhatsappService,
    @Optional() private readonly redis?: RedisService,
    @Optional() private readonly direcciones?: DireccionesService,
    @Optional() private readonly moduleRef?: ModuleRef,
    @Optional() private readonly numeros?: NumerosWhatsappService,
    @Optional() private readonly evolutionApi?: EvolutionApiCliente,
    @Optional() private readonly autorespuesta?: AutorespuestaWhatsappService,
    @Optional() private readonly evolutionAdaptador?: WhatsAppEvolutionAdaptador,
  ) {
    this.verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN', '').trim();
    this.appSecret = this.configService.get<string>('WHATSAPP_APP_SECRET', '').trim();
    this.apiVersion = this.configService.get<string>('WHATSAPP_API_VERSION', 'v20.0').trim();
    this.waToken = this.configService.get<string>('WHATSAPP_TOKEN', '').trim();
  }

  /**
   * Verifica la suscripción inicial del Webhook de WhatsApp (GET /whatsapp/webhook).
   */
  verificarSuscripcion(mode?: string, token?: string, challenge?: string): string {
    if (mode === 'subscribe' && token && this.verifyToken && token === this.verifyToken) {
      this.logger.log('Suscripción a Webhook de WhatsApp verificada exitosamente.');
      return challenge || '';
    }

    this.logger.warn('Fallo en la verificación de suscripción al Webhook de WhatsApp.');
    throw new ForbiddenException({
      codigo: 'VERIFICACION_WEBHOOK_FALLIDA',
      mensaje: 'Token de verificación de webhook no válido',
    });
  }

  /**
   * Valida la firma HMAC-SHA256 (cabecera X-Hub-Signature-256) sobre el cuerpo crudo.
   * Utiliza comparación en tiempo constante (crypto.timingSafeEqual) para mitigar timing attacks.
   */
  validarFirma(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      this.logger.warn(
        'WHATSAPP_APP_SECRET no está configurado en el servidor. Rechazando por seguridad.',
      );
      return false;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      this.logger.warn('Cabecera X-Hub-Signature-256 ausente o formato incorrecto.');
      return false;
    }

    if (!rawBody || rawBody.length === 0) {
      this.logger.warn('Cuerpo crudo (rawBody) vacío para validación de firma.');
      return false;
    }

    const hmac = crypto.createHmac('sha256', this.appSecret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    const sigBuffer = Buffer.from(signatureHeader, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Procesa de forma idempotente las actualizaciones de estado de entrega de Meta.
   */
  private async procesarEstado(status: any) {
    const waMessageId = status?.id;
    const nuevoEstado = String(status?.status || '').toLowerCase();
    if (!waMessageId) return;

    let estadoFinal: string | null = null;
    if (nuevoEstado === 'sent') estadoFinal = 'ENVIADO';
    else if (nuevoEstado === 'delivered') estadoFinal = 'ENTREGADO';
    else if (nuevoEstado === 'read') estadoFinal = 'LEIDO';
    else if (nuevoEstado === 'failed') estadoFinal = 'FALLIDO';

    if (!estadoFinal) return;

    let errorCodigo: string | null = null;
    let errorDetalle: string | null = null;

    if (status.errors && status.errors.length > 0) {
      const err = status.errors[0];
      errorCodigo = String(err.code || 'ERROR_META');
      // code + title + message + error_data.details: lo que Meta dio, para ver por qué falló
      errorDetalle = sanearDetalleMeta(
        [err.title, err.message, err.error_data?.details].filter((t, i, a) => t && a.indexOf(t) === i).join(' | '),
      );
    }

    try {
      const previo = await this.prisma.whatsappMensaje.findFirst({
        where: { wa_message_id: waMessageId },
        select: { id: true, estado: true, direccion: true, conversacion_id: true },
      });

      await this.prisma.whatsappMensaje.updateMany({
        where: { wa_message_id: waMessageId },
        data: {
          estado: estadoFinal,
          ...(errorCodigo ? { error_codigo: errorCodigo } : {}),
          ...(errorDetalle ? { error_detalle: errorDetalle } : {}),
        },
      });

      if (previo?.conversacion_id) {
        this.eventos?.emitirAdmin('mensajes:actualizado', {
          id: previo.conversacion_id.toString(),
        });
      }

      // Falla asíncrona de un saliente nuestro (Meta lo aceptó y después no lo entregó): se avisa en el chat y,
      // si era un carrusel, se reenvía la lista una sola vez (solo en la transición a FALLIDO)
      if (estadoFinal === 'FALLIDO' && previo && previo.estado !== 'FALLIDO' && previo.direccion === 'SALIENTE') {
        await this.atenderFalloAsincrono(previo, waMessageId, errorCodigo, errorDetalle);
      }
      // El saliente del outbox figuraba ENVIADO: ahora pasa a FALLIDO con el motivo de Meta (visible y reenviable en Salientes)
      if (estadoFinal === 'FALLIDO' && this.outbox) {
        await this.outbox.marcarFalloAsincrono(waMessageId, errorCodigo, errorDetalle);
      }
    } catch (err: any) {
      this.logger.error(`Error actualizando estado para waMessageId ${waMessageId}: ${err.message}`);
    }
  }

  private async atenderFalloAsincrono(
    previo: { id: bigint; conversacion_id: bigint | null },
    waMessageId: string,
    errorCodigo: string | null,
    errorDetalle: string | null,
  ) {
    if (!previo.conversacion_id) return;
    const motivo = `${errorCodigo ?? 'ERROR_META'}${errorDetalle ? `: ${errorDetalle}` : ''}`;
    const chat = await this.prisma.mensajeChat.findFirst({
      where: { OR: [{ meta_id: waMessageId }, { whatsapp_mensaje_id: previo.id }] },
      select: { contenido: true },
    });
    const contenido = (chat?.contenido as any) ?? {};
    const rp = contenido.carrusel === true ? contenido.respaldo : null;
    const conv = rp
      ? await this.prisma.conversacion.findUnique({ where: { id: previo.conversacion_id }, select: { telefono: true } })
      : null;
    const destino = conv?.telefono ? normalizarTelefono(conv.telefono) || conv.telefono.trim() : null;
    const reenviar = Boolean(rp && destino && (rp.filas?.length || rp.botones?.length));

    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: previo.conversacion_id,
        direccion: 'SALE',
        autor: 'BOT',
        tipo: 'SISTEMA',
        contenido: {
          texto: rp
            ? `El carrusel no se entregó (${motivo})${reenviar ? '; se envió la lista.' : '.'}`
            : `El mensaje no se entregó (${motivo}).`,
        } as any,
      },
    });

    if (reenviar) {
      const opciones = { conversacionId: previo.conversacion_id };
      const r = rp.filas?.length
        ? await this.mensajeria.enviarLista(destino!, rp.texto, rp.botonTexto ?? 'Ver productos', rp.filas.slice(0, 10), {
            ...opciones,
            tituloSeccion: rp.tituloSeccion,
          })
        : await this.mensajeria.enviarBotones(destino!, rp.texto, rp.botones.slice(0, 3), opciones);
      await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: previo.conversacion_id,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: rp.filas?.length ? 'LISTA' : 'BOTON',
          contenido: { texto: rp.texto, botonTexto: rp.botonTexto, filas: rp.filas, botones: rp.botones, carruselRespaldo: true } as any,
          meta_id: r.waMessageId || null,
        },
      });
    }
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: previo.conversacion_id.toString() });
  }

  /**
   * Descarga segura de archivo adjunto (imagen o PDF de voucher) desde WhatsApp Cloud API.
   */
  async descargarMediaSegura(
    mediaId: string,
    mimeType: string,
    opciones: { tipos?: string[]; maxBytes?: number } = {},
  ): Promise<Buffer | null> {
    const maxBytes = opciones.maxBytes ?? MAX_MEDIA_BYTES;
    // Adjunto recibido por Evolution (id «evo:<mensaje>»): se pide a esa API, mismas validaciones de tipo y tamaño
    if (mediaId.startsWith('evo:')) {
      if (!(opciones.tipos ?? TIPOS_MEDIA_PERMITIDOS).includes(mimeType)) {
        this.logger.warn(`Tipo de medio no permitido: ${mimeType}`);
        return null;
      }
      const m = await this.evolutionApi?.descargarMedia(mediaId.slice(4));
      if (!m || m.buffer.length > maxBytes) return null;
      return m.buffer;
    }
    if (!this.waToken) {
      this.logger.warn('Sin WHATSAPP_TOKEN para descargar archivo adjunto.');
      return null;
    }

    if (!(opciones.tipos ?? TIPOS_MEDIA_PERMITIDOS).includes(mimeType)) {
      this.logger.warn(`Tipo de medio no permitido: ${mimeType}`);
      return null;
    }

    try {
      // 1. Obtener URL de descarga
      const urlInfo = `https://graph.facebook.com/${this.apiVersion}/${mediaId}`;
      const resInfo = await fetch(urlInfo, {
        headers: { Authorization: `Bearer ${this.waToken}` },
      });
      if (!resInfo.ok) {
        this.logger.error(`Error obteniendo URL de media Meta: ${resInfo.status}`);
        return null;
      }

      const infoData = await resInfo.json();
      const downloadUrl = infoData.url;
      if (!downloadUrl) return null;

      // 2. Descargar buffer
      const resDownload = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${this.waToken}` },
      });
      if (!resDownload.ok) {
        this.logger.error(`Error descargando bytes de media Meta: ${resDownload.status}`);
        return null;
      }

      // Si el servidor ya declara un tamaño mayor al permitido, ni se descarga
      if (Number(resDownload.headers?.get?.('content-length')) > maxBytes) {
        this.logger.warn('Media excede tamaño máximo (según cabecera)');
        return null;
      }
      const arrayBuffer = await resDownload.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > maxBytes) {
        this.logger.warn(`Media excede tamaño máximo (${buffer.length} bytes)`);
        return null;
      }

      return buffer;
    } catch (err: any) {
      this.logger.error(`Excepción descargando media de Meta: ${err.message}`);
      return null;
    }
  }

  /**
   * Procesa un mensaje entrante de un cliente (texto, interactivo/botón o imagen).
   */
  private async procesarMensajeEntrante(msg: any, contacts: any[] = [], receptor?: ReceptorWhatsapp) {
    // Un solo mensaje por conversación a la vez: el toque rápido espera al anterior y lee el estado ya guardado.
    const de = String(msg?.from || msg?.from_user_id || contacts?.[0]?.wa_id || msg?.id || '').replace(/\D/g, '') || String(msg?.from_user_id || msg?.id || 'anon');
    let redisCliente: any = null;
    try { redisCliente = this.redis?.obtenerCliente() ?? null; } catch { redisCliente = null; }
    const ejecucion = ejecutarEnSerie(`wa:${de}`, redisCliente, () => this.procesarMensajeEntranteSerie(msg, contacts, receptor));
    // Diagnóstico: si un mensaje de verificación revienta antes de llegar a su rama, queda constancia (el error sigue su curso)
    if (msg?.type === 'text' && esMensajeVerificacion(String(msg.text?.body ?? ''))) {
      return ejecucion.catch((err: any) => {
        this.logger.error(`[verificacion] el mensaje falló antes de verificarse: ${err?.message}`);
        throw err;
      });
    }
    return ejecucion;
  }

  private async procesarMensajeEntranteSerie(msg: any, contacts: any[] = [], receptor?: ReceptorWhatsapp) {
    const waMessageId = msg.id;

    // Contacto y nombre de perfil defensivo (contacts[].profile.name)
    const listaContactos = Array.isArray(contacts) ? contacts : [];
    const contact =
      listaContactos.find(
        (c) =>
          (c.wa_id && (c.wa_id === msg.from || c.wa_id === msg.from_user_id)) ||
          (c.user_id && (c.user_id === msg.from || c.user_id === msg.from_user_id)),
      ) ||
      (listaContactos.length > 0 ? listaContactos[0] : null);

    const rawProfileName = contact?.profile?.name || msg.profile?.name;
    const nombrePerfil = limpiarNombrePerfil(rawProfileName);

    // Identificación: teléfono normalizado o identificador de usuario (BSUID)
    const rawFrom = String(msg.from || contact?.wa_id || '').trim();
    const esTelefonoValido = /^\+?\d{7,15}$/.test(rawFrom);

    let identificador: string;
    let tipoIdentificador: string;
    let telefonoNorm: string | null = null;
    let telHash: string;
    let telMask: string;

    if (esTelefonoValido) {
      telefonoNorm = normalizarTelefono(rawFrom);
      identificador = telefonoNorm;
      tipoIdentificador = 'TELEFONO';
      telHash = hashTelefono(telefonoNorm);
      telMask = enmascararTelefono(telefonoNorm);
    } else {
      const rawUserId = String(
        msg.from_user_id ||
          contact?.user_id ||
          (!esTelefonoValido && rawFrom ? rawFrom : '') ||
          '',
      ).trim();
      const userId = rawUserId || (msg.id ? `desconocido_${msg.id}` : `anonimo_${Date.now()}`);
      identificador = `wa-user:${userId}`;
      tipoIdentificador = 'USUARIO_WA';
      telefonoNorm = null;
      telHash = hashTelefono(identificador);
      telMask = 'Usuario de WhatsApp';
    }

    const tipo = msg.type;

    // IDEMPOTENCIA: Verificar si ya procesamos este wa_message_id
    if (waMessageId) {
      const yaProcesado = await this.prisma.whatsappMensaje.findUnique({
        where: { wa_message_id: waMessageId },
        select: { id: true },
      });
      if (yaProcesado) {
        this.logger.log(`Mensaje ${waMessageId} ya procesado anteriormente. Omitiendo.`);
        return false;
      }
    }

    let texto = '';
    let buttonPayload: string | null = null;
    let tipoRegistro = 'TEXTO';
    let imagenBuffer: Buffer | null = null;
    let imagenMime = '';
    // Nota de voz / audio: se guarda en privado (se escucha en Mensajes) 
    let audioGuardado: { archivoId: string; mime: string } | null = null;
    // Documento (PDF, Word...) del cliente cuando el bot no espera un voucher: se guarda privado y lo revisa una persona
    let documentoGuardado: { archivoId: string; nombre: string; mime: string; bytes: number } | null = null;
    let avisoDocumento: string | null = null;
    let ubicacion: { latitud: number; longitud: number; nombre?: string; direccion?: string } | undefined;
    const clasificacion: ClasificacionMensajeEntrante = clasificarMensajeEntrante(msg);
    const esNoCompatible = clasificacion.clase === 'NO_COMPATIBLE';

    if (clasificacion.clase === 'TEXTO') {
      texto = String(msg.text?.body || '').trim();
      tipoRegistro = 'TEXTO';
    } else if (clasificacion.clase === 'BOTON' && tipo === 'button') {
      texto = String(msg.button?.text || '').trim();
      buttonPayload = String(msg.button?.payload || texto).trim();
      tipoRegistro = 'BOTON';
    } else if (clasificacion.clase === 'BOTON') {
      tipoRegistro = 'BOTON';
      if (msg.interactive?.type === 'button_reply') {
        buttonPayload = String(msg.interactive.button_reply.id || '').trim();
        texto = String(msg.interactive.button_reply.title || '').trim();
      } else if (msg.interactive?.type === 'list_reply') {
        buttonPayload = String(msg.interactive.list_reply.id || '').trim();
        texto = String(msg.interactive.list_reply.title || '').trim();
      }
    } else if (clasificacion.clase === 'UBICACION') {
      tipoRegistro = 'UBICACION';
      const lat = Number(msg.location?.latitude);
      const lng = Number(msg.location?.longitude);
      const locNombre = msg.location?.name ? String(msg.location.name).trim() : undefined;
      const locDir = msg.location?.address ? String(msg.location.address).trim() : undefined;
      ubicacion = {
        latitud: lat,
        longitud: lng,
        nombre: locNombre,
        direccion: locDir,
      };
      texto = locDir || locNombre || 'Ubicación compartida por WhatsApp';
    } else if (clasificacion.clase === 'IMAGEN') {
      tipoRegistro = 'IMAGEN';
      texto = String(msg.image?.caption || '[Imagen de comprobante adjunta]').trim();
      imagenMime = msg.image?.mime_type || 'image/jpeg';
      if (msg.image?.id) {
        imagenBuffer = await this.descargarMediaSegura(msg.image.id, imagenMime);
      }
    } else if (clasificacion.clase === 'REACCION') {
      // Un emoji sobre un mensaje no es una respuesta: se muestra en el chat pero no avanza el flujo.
      tipoRegistro = 'OTRO';
      const emoji = String(msg.reaction?.emoji || '').trim();
      texto = emoji ? `Reaccionó con ${emoji}` : 'Quitó su reacción';
    } else {
      // NO_COMPATIBLE (video, sticker, documento...): no se descarga ni se pasa al motor.
      tipoRegistro = 'OTRO';
      texto = clasificacion.etiqueta;
      if (tipo === 'audio' && msg.audio?.id) {
        audioGuardado = await this.guardarAudio(msg.audio.id, String(msg.audio.mime_type || 'audio/ogg'));
      }
    }

    if (clasificacion.clase === 'TEXTO' && esMensajeVerificacion(texto)) {
      this.logger.log(`[verificacion] mensaje de verificación recibido (${telMask}, identificador ${tipoIdentificador}, wa_id ${waMessageId ? 'sí' : 'no'})`);
    }

    // Asociar a conversación existente o crearla de forma defensiva
    let conversacion = await this.prisma.conversacion.findUnique({
      where: { telefono: identificador },
    });

    if (!conversacion) {
      conversacion = await this.prisma.conversacion.create({
        data: {
          telefono: identificador,
          duenio: 'BOT',
          estado: 'ABIERTA',
          nombre_contacto: nombrePerfil,
          nombre_editado: false,
          identificador_tipo: tipoIdentificador,
          phone_number_id: receptor?.id ?? null,
          numero_receptor: receptor?.display ?? null,
          flujo: nombrePerfil ? { nombre_perfil_wa: nombrePerfil } : undefined,
          ultima_actividad: new Date(),
        },
      });
    } else {
      const flujoActual = (conversacion.flujo as any) || {};
      const dataUpdate: any = { ultima_actividad: new Date() };

      // Preservar en flujo el último perfil recibido de WhatsApp
      if (nombrePerfil && flujoActual.nombre_perfil_wa !== nombrePerfil) {
        dataUpdate.flujo = { ...flujoActual, nombre_perfil_wa: nombrePerfil };
      }

      // Actualizar nombre_contacto solo si NO ha sido editado a mano
      if (!conversacion.nombre_editado && nombrePerfil && conversacion.nombre_contacto !== nombrePerfil) {
        dataUpdate.nombre_contacto = nombrePerfil;
      }

      if (conversacion.identificador_tipo !== tipoIdentificador) {
        dataUpdate.identificador_tipo = tipoIdentificador;
      }

      // Se responde desde el numero por el que escribio el cliente (la ventana de 24 h es por numero)
      if (receptor && conversacion.phone_number_id !== receptor.id) {
        dataUpdate.phone_number_id = receptor.id;
        dataUpdate.numero_receptor = receptor.display ?? null;
      }

      conversacion = await this.prisma.conversacion.update({
        where: { id: conversacion.id },
        data: dataUpdate,
      });
    }

    // Documento del cliente: si el bot espera un voucher se mantiene lo de siempre (pedir foto); si no, se recibe
    if (tipo === 'document' && msg.document?.id) {
      const esperaVoucher =
        conversacion.estado === 'VALIDAR_PAGO' ||
        Boolean(await pedidoEsperandoVoucher(this.prisma, conversacion.flujo, telefonoNorm));
      if (!esperaVoucher) {
        const r = await this.guardarDocumento(msg.document);
        if (r.ok) documentoGuardado = r.doc;
        else avisoDocumento = r.aviso;
      }
    }

    // 1. Detección de consentimiento Ley 29733 (BAJA / STOP / NO MAS / ALTA)
    const textoNorm = texto.toLowerCase().trim();
    // «no mas» ya no da de baja: es la respuesta natural a «¿algo más?» y dejaba al cliente sin avisos de su pedido
    if (textoNorm === 'baja' || textoNorm === 'stop') {
      await this.prisma.clienteWhatsappConsentimiento.upsert({
        where: { telefono_hash: telHash },
        create: {
          telefono_hash: telHash,
          acepta: false,
          origen: 'WEBHOOK_BAJA',
          en: new Date(),
        },
        update: {
          acepta: false,
          origen: 'WEBHOOK_BAJA',
          en: new Date(),
        },
      });

      this.logger.log(`Consentimiento revocado (BAJA) para cliente ${telMask}`);

      // Confirmar al cliente (solo si tiene número de teléfono)
      if (telefonoNorm) {
        await this.mensajeria.enviarTexto(
          telefonoNorm,
          'Hemos registrado tu solicitud de baja. No te enviaremos mas mensajes promocionales ni informativos, salvo comunicaciones estrictamente operativas de pedidos que tengas en curso. Si deseas volver a recibir avisos escribe ALTA.',
        );
      }
    } else if (textoNorm === 'alta' || textoNorm === 'start') {
      await this.prisma.clienteWhatsappConsentimiento.upsert({
        where: { telefono_hash: telHash },
        create: {
          telefono_hash: telHash,
          acepta: true,
          origen: 'WEBHOOK_ALTA',
          en: new Date(),
        },
        update: {
          acepta: true,
          origen: 'WEBHOOK_ALTA',
          en: new Date(),
        },
      });
      if (telefonoNorm) {
        await this.mensajeria.enviarTexto(
          telefonoNorm,
          'Has reactivado los avisos de Caprichos. Te mantendremos informado sobre el estado de tus pedidos.',
        );
      }
    }

    // 2. Buscar último pedido activo o reciente del cliente para asociarlo (solo si tiene teléfono)
    // Chat sin número (LID): su celular vinculado hace de teléfono para ligar pedidos y vouchers
    const telefonoPedidos = telefonoNorm || telefonoDelChat(conversacion) || null;
    const pedidoReciente = telefonoPedidos
      ? await this.prisma.pedido.findFirst({
          where: {
            OR: [
              { cliente_telefono: { contains: telefonoPedidos.slice(-8) } },
              { cliente_telefono: telefonoPedidos },
            ],
          },
          orderBy: { creado_en: 'desc' },
          select: { id: true, codigo: true, cliente_nombre: true, estado: true, modalidad: true },
        })
      : null;

    // 5. Procesamiento de imagen de voucher
    let archivoMensajeId: string | null = null;
    // El voucher se liga al pedido que espera pago (no al último pedido del cliente, que puede estar cerrado)
    const pedidoVoucher = imagenBuffer && telefonoPedidos
      ? await pedidoEsperandoVoucher(this.prisma, conversacion?.flujo, telefonoPedidos)
      : null;
    // El voucher quedó ligado a un pedido: el cliente recibe un acuse y el motor no vuelve a contestar esa foto.
    let voucherAtendido = false;
    if (imagenBuffer && pedidoVoucher) {
      archivoMensajeId = await this.guardarVoucherPrivado(imagenBuffer, imagenMime, pedidoVoucher, telMask, conversacion);
      voucherAtendido = Boolean(archivoMensajeId);
    } else if (imagenBuffer) {
      // Imagen sin pedido asociado (o cliente sin teléfono, BSUID): igual se guarda en privado y se analiza
      // como voucher (sin pedido), para que Caja la vea en el chat y quede como prueba al aprobar.
      try {
        const sub = await this.archivosService.subirArchivo(
          {
            buffer: imagenBuffer,
            size: imagenBuffer.length,
            mimetype: imagenMime,
            originalname: `imagen-wa-${Date.now()}.jpg`,
            fieldname: 'file',
            encoding: '7bit',
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
          } as Express.Multer.File,
          true,
        );
        archivoMensajeId = String(sub.id);

        // Fila voucher_pago en segundo plano (no bloquea al bot; registrarDesdeWhatsapp nunca lanza)
        if (this.vouchersService) {
          void this.vouchersService.registrarDesdeWhatsapp(
            imagenBuffer,
            imagenMime,
            sub.id,
            null,
            conversacion,
          );
        }
      } catch (err: any) {
        this.logger.warn(`No se pudo guardar la imagen del chat: ${err.message}`);
      }
    } else if (tipo === 'image') {
      // Meta no devolvió los bytes (falla de descarga o más de 5 MB): no hay archivo que guardar.
      // Caja lo ve como aviso y pide que lo reenvíen.
      try {
        const notif = await this.prisma.notificacion.create({
          data: {
            tipo: 'COMPROBANTE_NO_GUARDADO',
            rol_destino: 'CAJERO',
            titulo: 'Comprobante no recibido',
            mensaje: `El cliente (${telMask}) envió una imagen que no se pudo guardar (más de 5 MB o falló la descarga). Pide que la reenvíe.`,
            enlace: '/admin/mensajes',
          },
        });
        this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });
      } catch (err: any) {
        this.logger.warn(`No se pudo avisar a Caja de la imagen no guardada: ${err.message}`);
      }
    }

    // Registrar mensaje en mensaje_chat del módulo de mensajes (la ubicación conserva sus coordenadas)
    // Un Plus Code escrito en texto (completo, o corto con «Lima») también ubica; el motor sigue viendo solo el texto
    const plusEscrito = !ubicacion && tipoRegistro === 'TEXTO' ? (plusCodeDesdeTexto(texto) ?? plusCodeDesdeTexto(`${texto} Lima`)) : null;
    const ubicacionGuardada: UbicacionCliente | null =
      ubicacion && ubicacionValida(ubicacion.latitud, ubicacion.longitud)
        ? { lat: ubicacion.latitud, lng: ubicacion.longitud, nombre: ubicacion.nombre, direccion: ubicacion.direccion }
        : plusEscrito
          ? { lat: plusEscrito.lat, lng: plusEscrito.lng, nombre: `Código Plus ${plusEscrito.codigo}` }
          : null;
    const ubicacionChat = await this.prisma.mensajeChat
      .create({
        data: {
          conversacion_id: conversacion.id,
          direccion: 'ENTRA',
          autor: 'CLIENTE',
          tipo: esNoCompatible
            ? tipoChatNoCompatible(clasificacion.subtipo)
            : tipoRegistro === 'IMAGEN'
              ? 'IMAGEN'
              : 'TEXTO',
          contenido: archivoMensajeId
            ? { texto, archivoId: archivoMensajeId }
            : documentoGuardado
              ? {
                  texto: textoDocumentoChat(documentoGuardado.nombre, documentoGuardado.bytes),
                  clase: 'DOCUMENTO',
                  subtipo: 'document',
                  waMessageId: waMessageId || null,
                  documento: documentoGuardado,
                }
              : esNoCompatible
              ? { texto, clase: audioGuardado ? 'NOTA_DE_VOZ' : clasificacion.clase, subtipo: clasificacion.subtipo, etiqueta: clasificacion.etiqueta, waMessageId: waMessageId || null,
                  ...(audioGuardado ? { audio: { archivoId: audioGuardado.archivoId, mime: audioGuardado.mime } } : {}) }
              : ubicacionGuardada
                ? { texto, ubicacion: ubicacionGuardada }
                : { texto },
          meta_id: waMessageId || null,
        },
      })
      .then((m) => (ubicacionGuardada ? { id: m.id, ubicacion: ubicacionGuardada } : null));
    if (ubicacionChat) void this.completarDireccionUbicacion(ubicacionChat.id, conversacion.id, ubicacionChat.ubicacion);

    // Registrar en tabla whatsapp_mensaje
    await this.prisma.whatsappMensaje.create({
      data: {
        direccion: 'ENTRANTE',
        wa_message_id: waMessageId || null,
        telefono_enmascarado: telMask,
        telefono_hash: telHash,
        tipo: tipoRegistro,
        estado: 'ENTREGADO',
        conversacion_id: conversacion.id,
        pedido_id: pedidoReciente?.id || null,
      },
    });

    // Notificar por websocket a la consola de mensajes
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });

    if (tipo === 'reaction') return true;

    // Verificación del celular (modo WHATSAPP_ENTRANTE): «Mi código: TOKEN» verifica el número que escribe.
    // Va ANTES del menú del bot: ese mensaje no recibe menú ni cuenta como conversación normal.
    // Sin bloqueo por spam: verificar es de un solo uso y ya tiene su propio límite de intentos.
    // Sin número visible (cuenta con usuario de WhatsApp): se explica, no se manda al bot ni se escala a una persona.
    if (clasificacion.clase === 'TEXTO' && esMensajeVerificacion(texto)) {
      // Un mensaje de verificación es del sistema: nunca pasa al bot (ni a su horario, pausa o chat tomado), aunque falle.
      if (telefonoNorm) {
        await this.atenderVerificacionCelular(telefonoNorm, texto, conversacion.id);
      } else {
        // LID sin número en el evento: se intenta averiguar el celular (tabla, Evolution); si no, el código de 6 dígitos
        const lid = /^wa-user:(\d+)@lid$/i.exec(identificador)?.[1] ?? null;
        this.logger.warn(`[verificacion] remitente sin número visible (${telMask}): se intenta resolver el celular`);
        await this.responderVerificacion(identificador, await this.resolverVerificacionSinNumero(texto, lid), conversacion.id);
      }
      return true;
    }

    // Audio, video, sticker, documento, etc.: no avanzan el flujo ni cuentan como calificación, reprogramación o voucher.
    // El bot avisa y repite el paso (ver atenderNoCompatible).
    // Nota de voz: el bot no la interpreta; una persona la escucha (aviso único al cliente, chat a persona y campana).
    const enPagoDelBot = conversacion.estado === 'VALIDAR_PAGO' || String(((conversacion.flujo as any) ?? {}).estado ?? '').startsWith('PAGO');
    if (tipo === 'image' && !voucherAtendido && !enPagoDelBot) {
      await this.atenderMediaParaPersona(conversacion, identificador, telefonoNorm, telHash, waMessageId, {
        motivo: MOTIVO_DERIVACION_IMAGEN,
        titulo: `Imagen de ${obtenerNombreMostrar(conversacion)}: hay que revisarla`,
        mensaje: 'El cliente envió una imagen sin un pedido esperando pago. El bot no la analiza: ábrela en el chat y respóndele.',
        textoCliente: TEXTO_IMAGEN_RECIBIDA,
        etapa: 'IMAGEN_RECIBIDA',
        clave: 'imagen',
        limitarAviso: true,
      });
      return true;
    }
    if (tipo === 'audio') {
      await this.atenderNotaDeVoz(conversacion, identificador, telefonoNorm, telHash, waMessageId);
      return true;
    }
    if (documentoGuardado) {
      await this.atenderMediaParaPersona(conversacion, identificador, telefonoNorm, telHash, waMessageId, {
        motivo: MOTIVO_DERIVACION_DOCUMENTO,
        titulo: `Documento de ${obtenerNombreMostrar(conversacion)}: hay que revisarlo`,
        mensaje: 'El cliente envió un documento. Ábrelo en el chat (botón Descargar) y respóndele.',
        textoCliente: TEXTO_DOCUMENTO_RECIBIDO,
        etapa: 'DOCUMENTO_RECIBIDO',
        clave: 'documento',
        limitarAviso: true,
      });
      return true;
    }
    if (esNoCompatible) {
      await this.atenderNoCompatible({
        avisoPropio: avisoDocumento,
        conversacion,
        clasificacion,
        identificador,
        telefonoNorm,
        telHash,
        waMessageId,
      });
      return true;
    }

    // Voucher recibido: ✅ sobre su mensaje en vez de un texto (con Evolution y con Meta). Si la reacción no sale, va el acuse en texto.
    const voucherReaccionado = voucherAtendido && telefonoNorm && this.autorespuesta
      ? await this.autorespuesta.reaccionarAVoucher(telefonoNorm, waMessageId)
      : false;
    // Acuse del voucher por el outbox (registrado en el chat). No aprueba nada: Caja revisa el pago.
    if (voucherAtendido && !voucherReaccionado && pedidoVoucher && telefonoNorm && this.outbox) {
      try {
        const nombre = obtenerNombreMostrar(conversacion);
        await this.outbox.encolar({
          telefono: telefonoNorm,
          tipo: 'TEXTO',
          clave: `voucher-recibido-${archivoMensajeId}`,
          origen: 'VOUCHER',
          pedidoId: pedidoVoucher.id,
          carga: {
            textoLibre: `¡Recibimos tu voucher, ${nombre}! 🙌 Es del pedido ${pedidoVoucher.codigo}. Una persona de Caja lo está revisando y te avisamos por aquí apenas confirme tu pago. Gracias por tu paciencia 💛`,
            autor: 'BOT',
            nombre,
            pedidoCodigo: pedidoVoucher.codigo,
            etapa: 'VOUCHER_RECIBIDO',
          },
        });
        this.outbox.despertar();
      } catch (err: any) {
        this.logger.error(`No se pudo encolar el acuse del voucher: ${err.message}`);
      }
    }

    // 5.5. Interceptar acciones de botones del equipo si el remitente es un miembro del equipo
    if (this.avisosInternosService && buttonPayload) {
      try {
        const respuestaAccion = await this.avisosInternosService.procesarAccionEquipo(
          telefonoNorm || rawFrom,
          buttonPayload,
        );
        if (respuestaAccion.procesado) {
          return true;
        }
      } catch (err: any) {
        this.logger.warn(`Error al procesar acción de equipo: ${err.message}`);
      }
    }

    // 5.6. Calificación de la encuesta posventa (después de registrar el mensaje en el chat).
    // Si el mensaje es la calificación, queda consumido: el bot no contesta nada más.
    const encuestaAtendida = await this.procesarPosibleEncuesta(
      telHash,
      telMask,
      texto,
      buttonPayload,
      telefonoNorm,
      conversacion,
    );

    // 5.7. Respuesta SI/NO a la pregunta de reprogramar (después de registrar el mensaje en el chat)
    // Respuesta SI/NO a la pregunta de reprogramar tras el retiro (solo si hay una pregunta pendiente)
    let reprogramacionAtendida = false;
    if (telefonoNorm && this.reprogramacion) {
      try {
        reprogramacionAtendida = await this.reprogramacion.procesarRespuesta(telefonoNorm, texto, buttonPayload);
      } catch (err: any) {
        this.logger.error(`Error al procesar respuesta de reprogramación: ${err.message}`, err.stack);
      }
    }

    // 5.8. Ubicación (pin) de un cliente con delivery activo: se asigna a su pedido (o queda como propuesta para Caja)
    const ubicacionAtendida = await this.atenderUbicacionDePedido(conversacion, ubicacionGuardada, telefonoNorm);

    // 5.9. «Hola, mi pedido CP-XXXX» (botón de la carta): vincula el chat con el pedido y sale al instante el resumen
    // que la regla anti-baneo no pudo mandar antes (el cliente aún no había escrito). Una sola vez por pedido.
    let resumenCartaAtendido = false;
    if (this.outbox && clasificacion.clase === 'TEXTO' && !voucherAtendido) {
      resumenCartaAtendido = await enviarResumenPendienteDeCarta(this.prisma, this.outbox, conversacion as any, texto).catch((err: any) => {
        this.logger.warn(`Resumen del pedido de la carta no enviado: ${err?.message}`);
        return false;
      });
    }

    // 6. Invocación segura del motor de conversación (Ola 1 Agente B)
    // El bot responde únicamente si la conversación le pertenece y el cliente no solicitó baja/alta
    const esComandoBajaOAlta =
      textoNorm === 'baja' ||
      textoNorm === 'stop' ||
      textoNorm === 'alta' ||
      textoNorm === 'start';

    // El bot responde si la conversación le pertenece (duenio === 'BOT'), si está en estado VALIDAR_PAGO
    // conforme a la regla de contrato (mientras hay un pago pendiente de validar el bot sigue atendiendo consultas),
    // o si el flujo está en ATENCION_PERSONA para evaluar el Modo Asistido si aplica.
    const flujoObj = (conversacion.flujo as Record<string, any>) || {};
    const esAtencionPersona =
      flujoObj.estado === 'ATENCION_PERSONA' && !conversacion.tomado_por;

    const puedeProcesarMotor =
      conversacion.duenio === 'BOT' ||
      conversacion.estado === 'VALIDAR_PAGO' ||
      // Derivado por calificación baja y sin persona: el motor aplica el modo asistido (responde si nadie lo tomó)
      (conversacion.motivo_derivacion === 'CALIFICACION_BAJA' && !conversacion.tomado_por) ||
      esAtencionPersona;

    // Cortesías sin bot: ❤️ a un «gracias», y con el bot apagado o el chat en manos de una persona, el aviso de fuera de
    // horario y la bienvenida con la carta (una vez cada 12 h). Con el bot activo no cambia nada: él ya saluda y avisa el horario.
    let cortesiaAtendida = false;
    if (this.autorespuesta && telefonoNorm && clasificacion.clase === 'TEXTO' && !esComandoBajaOAlta && !encuestaAtendida && !reprogramacionAtendida && !ubicacionAtendida && !voucherAtendido && !resumenCartaAtendido) {
      try {
        cortesiaAtendida = await this.autorespuesta.atender({
          telefono: telefonoNorm,
          nombre: obtenerNombreMostrar(conversacion),
          texto,
          waMessageId,
          conversacion: conversacion as any,
          puedeProcesarMotor,
        });
      } catch (err: any) {
        this.logger.error(`Error en la cortesía automática: ${err.message}`, err.stack);
      }
    }

    // Un chat en manos de una persona también pasa por el motor: él decide si calla (el equipo conversa) o retoma
    // (20 min sin actividad del equipo). Antes un chat con dueño PERSONA no llegaba y el cliente quedaba sin respuesta.
    const motorDecide = puedeProcesarMotor || conversacion.duenio !== 'BOT' || conversacion.tomado_por != null;
    if (
      this.motorConversacion &&
      !esComandoBajaOAlta &&
      !cortesiaAtendida &&
      motorDecide &&
      !reprogramacionAtendida &&
      !ubicacionAtendida &&
      !encuestaAtendida &&
      !voucherAtendido &&
      !resumenCartaAtendido
    ) {
      const consentimiento = await this.prisma.clienteWhatsappConsentimiento.findUnique({
        where: { telefono_hash: telHash },
      });
      const consentimientoRevocado = consentimiento && !consentimiento.acepta;

      if (!consentimientoRevocado) {
        try {
          await this.motorConversacion.procesarMensajeEntrante(conversacion.id, {
            texto,
            buttonPayload,
            listReplyId: msg.interactive?.type === 'list_reply' ? msg.interactive.list_reply.id : undefined,
            tipo,
            waMessageId,
            telefono: telefonoNorm || undefined,
            telMask,
            ubicacion,
          });
        } catch (err: any) {
          this.logger.error(
            `Error al invocar motor conversacional para conversación ${conversacion.id}: ${err.message}`,
            err.stack,
          );
          // El mensaje ya quedó registrado (no se reintenta): sin esto el cliente se quedaba sin respuesta ni aviso
          await this.avisarFalloDelBot(telefonoNorm, waMessageId);
        }
      }
    }

    return true;
  }

  /** Disculpa breve cuando el motor del bot falla: una sola vez por mensaje (clave idempotente) y sin lanzar error. */
  private async avisarFalloDelBot(telefono: string | null, waMessageId?: string): Promise<void> {
    if (!telefono || !waMessageId || !this.outbox) return;
    try {
      await this.outbox.encolar({
        telefono,
        tipo: 'TEXTO',
        clave: `error-bot-${waMessageId}`,
        origen: 'BOT_ERROR',
        carga: {
          textoLibre: 'Tuvimos un inconveniente al procesar tu mensaje 🙏 Escríbelo de nuevo en un momento, o escribe *asesor* y una persona te ayuda.',
          autor: 'BOT',
          etapa: 'ERROR_BOT',
        },
      });
      this.outbox.despertar();
    } catch (err: any) {
      this.logger.error(`No se pudo avisar al cliente del fallo del bot: ${err.message}`);
    }
  }

  /**
   * Ubicación de WhatsApp de un cliente con pedido delivery activo. No interviene si el cliente está armando un pedido
   * en el bot (el paso del flujo ya la usa). Nunca lanza: si falla, el motor sigue como siempre.
   */
  private async atenderUbicacionDePedido(
    conversacion: { flujo?: unknown },
    ubicacion: UbicacionCliente | null,
    telefonoNorm?: string | null,
  ): Promise<boolean> {
    if (!ubicacion || !telefonoNorm || !this.moduleRef) return false;
    const estado = String(((conversacion.flujo as Record<string, any>) ?? {}).estado ?? '');
    if (estado.startsWith('PEDIDO_')) return false;
    try {
      const puerto = this.moduleRef.get<UbicacionPedidoPuerto>(UBICACION_PEDIDO_PUERTO, { strict: false });
      const r = await puerto.recibir({ telefono: telefonoNorm, lat: ubicacion.lat, lng: ubicacion.lng, direccion: ubicacion.direccion });
      return r.atendida;
    } catch (err: any) {
      this.logger.error(`No se pudo asignar la ubicación a un pedido: ${err?.message}`, err?.stack);
      return false;
    }
  }

  /** Pone la dirección aproximada en la ubicación del chat. No bloquea al bot: si falla, la ubicación queda sin dirección. */
  private async completarDireccionUbicacion(
    mensajeId: bigint,
    conversacionId: bigint,
    ubicacion: UbicacionCliente,
  ): Promise<void> {
    try {
      const direccionAprox = this.direcciones ? await this.direcciones.inversa(ubicacion.lat, ubicacion.lng) : null;
      if (!direccionAprox) return;
      const fila = await this.prisma.mensajeChat.findUnique({ where: { id: mensajeId }, select: { contenido: true } });
      const contenido = (fila?.contenido as any) ?? {};
      if (!contenido.ubicacion) return;
      await this.prisma.mensajeChat.update({
        where: { id: mensajeId },
        data: { contenido: { ...contenido, ubicacion: { ...contenido.ubicacion, direccionAprox } } as any },
      });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacionId.toString() });
    } catch (err: any) {
      this.logger.warn(`No se pudo obtener la dirección de la ubicación: ${err?.message}`);
    }
  }

  /** Descarga y guarda en privado un audio del cliente. Devuelve null si falla algo (el mensaje igual queda en el chat). */
  private async guardarAudio(
    mediaId: string,
    mimeCrudo: string,
  ): Promise<{ archivoId: string; mime: string } | null> {
    // Meta manda «audio/ogg; codecs=opus»: se valida y guarda el tipo base
    const mime = mimeCrudo.split(';')[0].trim().toLowerCase();
    const buffer = await this.descargarMediaSegura(mediaId, mime, { tipos: TIPOS_AUDIO_PERMITIDOS, maxBytes: MAX_AUDIO_BYTES });
    if (!buffer) return null;
    try {
      const sub = await this.archivosService.subirAudio(buffer, mime);
      return { archivoId: sub.id, mime };
    } catch (err: any) {
      this.logger.warn(`No se pudo guardar el audio del chat: ${err.message}`);
      return null;
    }
  }

  /** El chat es del bot: sin persona, sin «Atención persona», sin validar pago y sin Atendido. */
  private botAtiendeAudio(conversacion: any): boolean {
    const flujo = (conversacion.flujo as Record<string, any>) || {};
    return (
      conversacion.duenio === 'BOT' &&
      conversacion.tomado_por == null &&
      flujo.estado !== 'ATENCION_PERSONA' &&
      conversacion.estado !== 'VALIDAR_PAGO' &&
      conversacion.estado !== 'ATENDIDA' &&
      !conversacion.atendido_en
    );
  }

  /**
   * Nota de voz del cliente (ya guardada en el chat). Siempre avisa al equipo por la campana (Admin y Caja, también con un pago
   * por revisar). Si el chat era del bot: responde UNA vez y lo pasa a una persona (urgente, Por atender). Si estaba en
   * Atendido: vuelve a Por atender sin responder. Si ya lo llevaba una persona o está en Validar pago: solo la notificación.
   * Nunca lanza.
   */
  private async atenderNotaDeVoz(
    conversacion: any,
    identificador: string,
    telefonoNorm: string | null,
    telHash: string,
    waMessageId?: string,
  ): Promise<void> {
    await this.atenderMediaParaPersona(conversacion, identificador, telefonoNorm, telHash, waMessageId, {
      motivo: MOTIVO_DERIVACION_NOTA_DE_VOZ,
      titulo: `Nota de voz de ${obtenerNombreMostrar(conversacion)}: hay que escucharla`,
      mensaje: 'El cliente envió una nota de voz. El bot no la interpreta: escúchala en el chat y respóndele.',
      textoCliente: TEXTO_NOTA_DE_VOZ,
      etapa: 'NOTA_DE_VOZ',
      clave: 'nota-de-voz',
      limitarAviso: false,
    });
  }

  /**
   * Nota de voz o documento del cliente (ya guardado en el chat): campana al equipo, chat a una persona si lo llevaba el bot
   * (o estaba Atendido) y UN solo aviso al cliente. Con limitarAviso, como mucho un aviso cada 2 minutos por conversación
   * (el cliente puede mandar 20 archivos seguidos). Nunca lanza.
   */
  private async atenderMediaParaPersona(
    conversacion: any,
    identificador: string,
    telefonoNorm: string | null,
    telHash: string,
    waMessageId: string | undefined,
    cfg: { motivo: string; titulo: string; mensaje: string; textoCliente: string; etapa: string; clave: string; limitarAviso: boolean },
  ): Promise<void> {
    try {
      const bot = this.botAtiendeAudio(conversacion);
      const atendido = conversacion.estado === 'ATENDIDA' || Boolean(conversacion.atendido_en);
      if (bot || atendido) {
        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            duenio: 'PERSONA',
            urgente: true,
            estado: !conversacion.estado || conversacion.estado === 'ATENDIDA' ? 'ABIERTA' : conversacion.estado,
            motivo_derivacion: cfg.motivo,
            ultima_actividad: new Date(),
          },
        });
      }

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'ATENCION_WHATSAPP',
          rol_destino: null,
          titulo: cfg.titulo,
          mensaje: cfg.mensaje,
          enlace: telefonoNorm ? `/admin/mensajes?telefono=${telefonoNorm.replace(/\D/g, '')}` : '/admin/mensajes',
        },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: cfg.titulo });

      // Aviso al cliente solo si el chat era del bot (consentimiento vigente y sin bloqueo por spam)
      if (!bot || !this.outbox) return;
      const consentimiento = await this.prisma.clienteWhatsappConsentimiento.findUnique({ where: { telefono_hash: telHash } });
      if ((consentimiento && !consentimiento.acepta) || (await this.spamBloqueado(identificador))) return;
      if (cfg.limitarAviso) {
        const reciente = await this.prisma.salienteWhatsapp.findFirst({
          where: {
            telefono_destino: identificador,
            origen: ORIGEN_NO_COMPATIBLE,
            creado_en: { gte: new Date(Date.now() - VENTANA_AVISO_NO_COMPATIBLE_MS) },
          },
          select: { id: true },
        });
        if (reciente) return;
      }
      await this.outbox.encolar({
        telefono: identificador,
        tipo: 'TEXTO',
        clave: `${cfg.clave}-${waMessageId || `${identificador}-${Date.now()}`}`,
        origen: ORIGEN_NO_COMPATIBLE,
        carga: { textoLibre: cfg.textoCliente, autor: 'BOT', nombre: obtenerNombreMostrar(conversacion), etapa: cfg.etapa },
      });
      this.outbox.despertar();
    } catch (err: any) {
      this.logger.warn(`No se pudo atender un mensaje con archivo del cliente: ${err.message}`);
    }
  }

  /**
   * Descarga y guarda en privado un documento del cliente. Valida extensión + tipo + primeros bytes y tamaño.
   * En logs solo tipo y tamaño, nunca el contenido ni el nombre.
   */
  private async guardarDocumento(
    doc: any,
  ): Promise<
    | { ok: true; doc: { archivoId: string; nombre: string; mime: string; bytes: number } }
    | { ok: false; aviso: string }
  > {
    const v = validarDocumento(doc?.filename || nombreSegunMime(doc?.mime_type), doc?.mime_type);
    if (!v.ok) {
      this.logger.warn(`Documento rechazado por tipo (${String(doc?.mime_type ?? '').slice(0, 80)})`);
      return { ok: false, aviso: TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO };
    }
    const buffer = await this.descargarMediaSegura(String(doc.id), v.mime, {
      tipos: TIPOS_DOCUMENTO_PERMITIDOS,
      maxBytes: MAX_DOCUMENTO_BYTES,
    });
    if (!buffer) return { ok: false, aviso: TEXTO_DOCUMENTO_NO_RECIBIDO };
    if (!contenidoCoincide(buffer, v.ext)) {
      this.logger.warn(`Documento rechazado: el contenido no coincide con ${v.ext} (${buffer.length} bytes)`);
      return { ok: false, aviso: TEXTO_DOCUMENTO_TIPO_NO_PERMITIDO };
    }
    try {
      const sub = await this.archivosService.subirDocumento(buffer, v.mime, v.nombre);
      this.logger.log(`Documento del cliente guardado (${v.mime}, ${buffer.length} bytes)`);
      return { ok: true, doc: { archivoId: sub.id, nombre: v.nombre, mime: v.mime, bytes: buffer.length } };
    } catch (err: any) {
      this.logger.warn(`No se pudo guardar el documento del chat: ${err.message}`);
      return { ok: false, aviso: TEXTO_DOCUMENTO_NO_RECIBIDO };
    }
  }

  /**
   * Audio, video, sticker, documento, etc. (no compatibles). No avanzan el flujo, no se descargan ni se guardan como dato,
   * y no cuentan como calificación, reprogramación ni voucher. Si el chat lo atiende el bot (no tomado, sin modo asistido,
   * consentimiento vigente): avisa como mucho una vez cada 2 minutos y repite el último mensaje del bot (el paso pendiente).
   * Tres seguidos sin texto ni botón válido derivan a una persona. Nunca lanza.
   */
  private async atenderNoCompatible(p: {
    conversacion: any;
    clasificacion: ClasificacionMensajeEntrante;
    identificador: string;
    telefonoNorm: string | null;
    telHash: string;
    waMessageId?: string;
    /** Aviso fijo (documento de tipo no permitido o que no se pudo recibir) en lugar del aviso genérico. */
    avisoPropio?: string | null;
  }): Promise<void> {
    try {
      const consentimiento = await this.prisma.clienteWhatsappConsentimiento.findUnique({
        where: { telefono_hash: p.telHash },
      });
      if (consentimiento && !consentimiento.acepta) return;

      // Bloqueo temporal por spam vigente (Redis): silencio, el mensaje ya quedó en el chat
      if (await this.spamBloqueado(p.identificador)) return;

      // El bot solo responde si el chat es suyo: sin persona tomándolo, sin modo asistido y no derivado a una persona.
      // En VALIDAR_PAGO sigue atendiendo (como el motor), salvo que ya lo derivamos por este motivo.
      const flujo = (p.conversacion.flujo as Record<string, any>) || {};
      const { duenio, estado, tomado_por, motivo_derivacion } = p.conversacion;
      const atiendeBot =
        tomado_por == null &&
        flujo.estado !== 'ATENCION_PERSONA' &&
        (duenio === 'BOT' ||
          (estado === 'VALIDAR_PAGO' && motivo_derivacion !== MOTIVO_DERIVACION_NO_COMPATIBLES));
      if (!atiendeBot) return;

      // Sticker suelto (sin paso pendiente: ni pedido, ni pago, ni voucher esperado): el bot NO responde nada (decisión del dueño 22/11)
      if (p.clasificacion.subtipo === 'sticker') {
        const pasoPendiente =
          Boolean(flujo.pedido || flujo.pago?.pedidoCodigo) ||
          /^(PEDIDO|PAGO|VALIDAR|RESERVA)/.test(String(flujo.estado ?? '')) ||
          estado === 'VALIDAR_PAGO' ||
          Boolean(await pedidoEsperandoVoucher(this.prisma, p.conversacion.flujo, p.telefonoNorm));
        if (!pasoPendiente) return;
      }

      const ultimos = await this.prisma.mensajeChat.findMany({
        where: { conversacion_id: p.conversacion.id, direccion: 'ENTRA' },
        orderBy: { id: 'desc' },
        take: LIMITE_NO_COMPATIBLES_SEGUIDOS,
        select: { contenido: true },
      });
      const seguidos =
        ultimos.length === LIMITE_NO_COMPATIBLES_SEGUIDOS &&
        ultimos.every((m) => (m.contenido as any)?.clase === 'NO_COMPATIBLE');
      if (seguidos) await this.derivarNoCompatibles(p.conversacion, p.telefonoNorm);

      // Como mucho un aviso cada 2 minutos por conversación (cuenta también lo que sigue pendiente en la cola)
      const avisoReciente = await this.prisma.salienteWhatsapp.findFirst({
        where: {
          telefono_destino: p.identificador,
          origen: ORIGEN_NO_COMPATIBLE,
          creado_en: { gte: new Date(Date.now() - VENTANA_AVISO_NO_COMPATIBLE_MS) },
        },
        select: { id: true },
      });
      if (avisoReciente || !this.outbox) return;

      const esperaVoucher =
        p.clasificacion.subtipo === 'document' &&
        (estado === 'VALIDAR_PAGO' ||
          Boolean(await pedidoEsperandoVoucher(this.prisma, p.conversacion.flujo, p.telefonoNorm)));
      const prompt = await this.ultimoPromptDelBot(p.conversacion.id);
      const repeticion = armarTextoRepeticion(prompt);
      // Con opciones en el último paso se repiten; fuera de un pedido o pago y sin opciones, va el menú principal
      const conOpciones = Boolean(prompt?.botones?.length || prompt?.filas?.length);
      const enCurso = Boolean(flujo.pedido || flujo.pago?.pedidoCodigo) || /^(PEDIDO|PAGO|VALIDAR|RESERVA)/.test(String(flujo.estado ?? ''));
      const conMenu = !p.avisoPropio && !conOpciones && !enCurso;
      const aviso = p.avisoPropio ?? textoAvisoNoCompatible(p.clasificacion.subtipo, esperaVoucher, conOpciones ? 'opciones' : conMenu ? 'menu' : 'respuesta');
      const interactivo = p.avisoPropio
        ? null
        : conMenu
          ? interactivoDesdeContenido({ texto: '¿En qué te ayudo? 😊', filas: FILAS_MENU_PRINCIPAL, botonTexto: BOTON_LISTA_MENU, tituloSeccion: TITULO_SECCION_MENU }, aviso)
          : interactivoDesdeContenido(prompt, aviso);

      await this.outbox.encolar({
        telefono: p.identificador,
        tipo: interactivo ? 'INTERACTIVO' : 'TEXTO',
        clave: `no-compatible-${p.waMessageId || `${p.identificador}-${Date.now()}`}`,
        origen: ORIGEN_NO_COMPATIBLE,
        carga: {
          textoLibre: repeticion && !p.avisoPropio && !conMenu ? `${aviso}\n\n${repeticion}` : aviso,
          ...(interactivo ? { interactivo } : {}),
          autor: 'BOT',
          nombre: obtenerNombreMostrar(p.conversacion),
          etapa: 'NO_COMPATIBLE',
        },
      });
      this.outbox.despertar();
    } catch (err: any) {
      this.logger.warn(`No se pudo atender un mensaje no compatible: ${err.message}`);
    }
  }

  /**
   * Verifica el celular con el token del mensaje. La marca se escribe ANTES de responder (la web la ve al instante),
   * y un fallo al responder no la deshace. Siempre termina con una respuesta al cliente, salvo que no haya número.
   */
  private async atenderVerificacionCelular(telefonoNorm: string, texto: string, conversacionId?: bigint): Promise<void> {
    const diagnostico = (evento: string, datos: Record<string, string | number | boolean> = {}) =>
      this.logger.log(`[verificacion] ${evento} ${JSON.stringify(datos)}`);
    let respuesta: string = RESPUESTA_NO_VERIFICADO;
    try {
      if (!this.redis) {
        this.logger.error('[verificacion] Redis no disponible en el webhook: no se puede verificar este mensaje');
      } else {
        const r = await atenderMensajeVerificacion(
          this.redis.obtenerCliente(),
          secretoVerificacion(this.configService),
          texto,
          telefonoNorm,
          diagnostico,
          true,
        );
        if (r) respuesta = r;
      }
    } catch (err: any) {
      this.logger.error(`[verificacion] error al verificar (Redis): ${err.message}`);
    }
    await this.responderVerificacion(telefonoNorm, respuesta, conversacionId);
  }

  /** Remitente sin número (LID): nunca lanza y siempre devuelve la frase a responder. */
  private async resolverVerificacionSinNumero(texto: string, lid: string | null): Promise<string> {
    const diagnostico = (evento: string, datos: Record<string, string | number | boolean> = {}) =>
      this.logger.log(`[verificacion] ${evento} ${JSON.stringify(datos)}`);
    try {
      if (!this.redis) {
        this.logger.error('[verificacion] Redis no disponible en el webhook: no se puede verificar este mensaje');
        return RESPUESTA_NO_VERIFICADO;
      }
      return await atenderVerificacionSinNumero(
        this.redis.obtenerCliente(),
        secretoVerificacion(this.configService),
        texto,
        lid,
        lid ? this.puenteLid(this.redis) : null,
        diagnostico,
      );
    } catch (err: any) {
      this.logger.error(`[verificacion] error al resolver el remitente sin número (Redis): ${err.message}`);
      return RESPUESTA_NO_VERIFICADO;
    }
  }

  /** Pares LID ↔ celular: primero lo aprendido (Redis, o el chat con celular vinculado), luego Evolution. */
  private puenteLid(redis: RedisService): PuenteLid {
    return {
      aprendido: async (lid) => {
        const guardado = await redis.obtenerCliente().get(claveParLidCelular(lid)).catch(() => null);
        if (guardado) return guardado;
        const chat = await this.prisma.conversacion.findUnique({ where: { telefono: `wa-user:${lid}@lid` }, select: { celular_vinculado: true } });
        return chat?.celular_vinculado ?? null;
      },
      numeroDeLid: async (lid) => (await this.evolutionAdaptador?.resolverLid(lid)) ?? null,
      confirmaLid: async (numero, lid) => (await this.evolutionAdaptador?.confirmarLid(numero, lid)) ?? 'NO_RESUELTO',
      aprender: async (lid, celular9) => {
        await this.vincularLidConCelular(lid, celular9);
      },
    };
  }

  /** Respuesta de la verificación por el puerto (Meta o Evolution). Nunca lanza; deja en el log si no salió y por qué. */
  private async responderVerificacion(destino: string, textoBase: string, conversacionId?: bigint): Promise<void> {
    // Con el enlace de la carta el cliente vuelve con un toque (a seguir, o a pedir un código nuevo)
    const carta = urlPublicaCarta((k) => this.configService.get<string>(k)) || 'https://caprichos.pe';
    const texto = `${textoBase}\n\n👉 ${carta}`;
    const sufijo = `a ***${String(destino).replace(/\D/g, '').slice(-3)}`;
    let waMessageId: string | null = null;
    try {
      const r: any = await this.mensajeria.enviarTexto(destino, texto);
      if (r && r.exito === false) {
        this.logger.warn(`[verificacion] respuesta NO enviada ${sufijo}: ${r.estado} ${r.errorCodigo ?? ''} ${String(r.errorDetalle ?? '').slice(0, 160)}`);
      } else {
        this.logger.log(`[verificacion] respuesta ${r?.estado ?? 'entregada'} ${sufijo}`);
        waMessageId = r?.waMessageId ?? null;
      }
    } catch (err: any) {
      this.logger.warn(`[verificacion] respuesta NO enviada ${sufijo}: excepción ${err?.message}`);
    }
    // La respuesta queda en el chat: el equipo la ve y el vigilante no toma el mensaje como «sin respuesta»
    if (!conversacionId) return;
    try {
      await this.prisma.mensajeChat.create({
        data: { conversacion_id: conversacionId, direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', contenido: { texto } as any, meta_id: waMessageId },
      });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacionId.toString() });
    } catch (err: any) {
      this.logger.warn(`[verificacion] no se pudo guardar la respuesta en el chat: ${err?.message}`);
    }
  }

  /** true si el contacto tiene un bloqueo temporal por spam vigente. Si Redis no responde, no bloquea (fail-open). */
  private async spamBloqueado(identificador: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const existe = await this.redis.obtenerCliente().exists(
        `chatbot:spam:bloqueo:${encodeURIComponent(identificador.trim())}`,
      );
      return existe === 1;
    } catch {
      return false;
    }
  }

  /** Último mensaje que el bot envió a la conversación (sin contar los avisos por tipos no compatibles). */
  private async ultimoPromptDelBot(conversacionId: bigint): Promise<any | null> {
    const mensajes = await this.prisma.mensajeChat.findMany({
      where: { conversacion_id: conversacionId, direccion: 'SALE', autor: 'BOT' },
      orderBy: { id: 'desc' },
      take: 5,
      select: { contenido: true },
    });
    const candidato = mensajes.find((m) => (m.contenido as any)?.origen !== ORIGEN_NO_COMPATIBLE);
    return candidato ? candidato.contenido : null;
  }

  /** Deriva a una persona (mismo patrón que la acción pasarAPersona del motor): dueño PERSONA, campana al equipo. */
  private async derivarNoCompatibles(conversacion: any, telefonoNorm: string | null): Promise<void> {
    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: {
        duenio: 'PERSONA',
        urgente: false,
        estado: !conversacion.estado || conversacion.estado === 'ATENDIDA' ? 'ABIERTA' : conversacion.estado,
        motivo_derivacion: MOTIVO_DERIVACION_NO_COMPATIBLES,
        ultima_actividad: new Date(),
      },
    });

    const titulo = `Atención requerida en WhatsApp (${obtenerNombreMostrar(conversacion)})`;
    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: 'ATENCION_WHATSAPP',
        rol_destino: null,
        titulo,
        mensaje: `El cliente envió ${LIMITE_NO_COMPATIBLES_SEGUIDOS} mensajes seguidos que el bot no puede leer (audios, videos u otros). Conviene atenderlo por el chat.`,
        enlace: telefonoNorm ? `/admin/mensajes?telefono=${telefonoNorm.replace(/\D/g, '')}` : '/admin/mensajes',
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
  }

  /**
   * Guarda de forma privada un comprobante recibido por WhatsApp y notifica a Caja.
   */
  private async guardarVoucherPrivado(
    buffer: Buffer,
    mimeType: string,
    pedido: any,
    telMask: string,
    conversacion?: any,
  ): Promise<string | null> {
    try {
      if (buffer.length > 5 * 1024 * 1024) {
        this.logger.warn(`Voucher rechazado: tamaño ${buffer.length} supera los 5MB permitidos.`);
        return null;
      }

      const fileMock: Express.Multer.File = {
        buffer,
        size: buffer.length,
        mimetype: mimeType,
        originalname: `comprobante-wa-${pedido.codigo}-${Date.now()}.jpg`,
        fieldname: 'file',
        encoding: '7bit',
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const archivoSubido = await this.archivosService.subirArchivo(fileMock, true);
      await this.ligarVoucherGuardado(buffer, mimeType, archivoSubido.id, pedido, telMask, conversacion);
      return String(archivoSubido.id);
    } catch (err: any) {
      this.logger.error(`Error guardando comprobante privado: ${err.message}`);
      return null;
    }
  }

  /** Liga un archivo ya guardado como voucher del pedido: anota el pago en el chat, avisa a Caja y analiza en segundo plano. */
  private async ligarVoucherGuardado(
    buffer: Buffer,
    mimeType: string,
    archivoId: bigint | string,
    pedido: any,
    telMask: string,
    conversacion?: any,
    mensajeId?: bigint | string,
  ): Promise<void> {
    const archivoSubido = { id: archivoId };

      // Enlazar captura a la conversación y al pedido. El chat NO se toma (la captura es opcional): el bot sigue
      // atendiendo y Caja recibe el aviso de campana para revisarla sin urgencia.
      if (conversacion?.id) {
        const flujoActual = (conversacion.flujo as any) || {};
        const pagoPrev = flujoActual.pago || {};
        const capturasEnviadas = (pagoPrev.capturasEnviadas || 0) + 1;

        await anotarPagoEnFlujo(this.prisma, conversacion, pedido, {
          comprobanteArchivoId: archivoSubido.id,
          capturasEnviadas,
          timestampUltimoVoucher: Date.now(),
        });
      }

      // Notificación de campana a Caja
      const tituloNotif = 'Comprobante de pago recibido';
      const mensajeNotif = `El cliente (${telMask}) envio un comprobante para el pedido ${pedido.codigo}.`;

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'COMPROBANTE_RECIBIDO',
          rol_destino: 'CAJERO',
          titulo: tituloNotif,
          mensaje: mensajeNotif,
          enlace: '/admin/mensajes',
        },
      });

      this.eventos?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo: tituloNotif,
      });

      this.logger.log(
        `Voucher privado guardado para pedido ${pedido.codigo} (archivo id: ${archivoSubido.id})`,
      );

      // Análisis y registro de voucher con IA en segundo plano (vch-api)
      if (this.vouchersService) {
        try {
          this.vouchersService
            .registrarDesdeWhatsapp(buffer, mimeType, archivoSubido.id, pedido, conversacion, mensajeId)
            .catch((err: any) => {
              this.logger.error(
                `Error en segundo plano al procesar voucher para pedido ${pedido.codigo}: ${err.message}`,
              );
            });
        } catch (err: any) {
          this.logger.error(
            `Error lanzando procesamiento de voucher en segundo plano: ${err.message}`,
          );
        }
      }

  }

  /**
   * Admin: baja de Evolution el archivo de un mensaje del cliente que quedó sin adjunto (imagen, nota de voz o documento)
   * y lo guarda en privado ligado al mensaje. Mismas validaciones de tipo y tamaño que al llegar. Nunca lanza.
   */
  async recuperarArchivoDeMensaje(mensajeId: bigint): Promise<{ ok: boolean; motivo?: string }> {
    try {
      const m = await this.prisma.mensajeChat.findUnique({ where: { id: mensajeId } });
      if (!m || (m.direccion !== 'ENTRA' && (m.contenido as any)?.canal !== CANAL_WHATSAPP_BUSINESS) || !m.meta_id || !['IMAGEN', 'AUDIO', 'DOCUMENTO'].includes(m.tipo)) {
        return { ok: false, motivo: 'Este mensaje no tiene un archivo que recuperar' };
      }
      const c = (m.contenido as any) ?? {};
      if (c.archivoId || c.audio?.archivoId || c.documento?.archivoId) return { ok: true };
      const media = await this.evolutionApi?.descargarMedia(m.meta_id);
      if (!media) return { ok: false, motivo: 'WhatsApp ya no tiene el archivo: pide al cliente que lo reenvíe' };
      let nuevo: Record<string, any>;
      if (m.tipo === 'IMAGEN') {
        if (!TIPOS_MEDIA_PERMITIDOS.includes(media.mime) || media.buffer.length > MAX_MEDIA_BYTES) return { ok: false, motivo: 'La imagen no es válida o pesa demasiado' };
        const sub = await this.archivosService.subirArchivo(
          { buffer: media.buffer, size: media.buffer.length, mimetype: media.mime, originalname: `imagen-wa-${Date.now()}.jpg`, fieldname: 'file', encoding: '7bit', stream: null as any, destination: '', filename: '', path: '' } as Express.Multer.File,
          true,
        );
        nuevo = { archivoId: String(sub.id) };
      } else if (m.tipo === 'AUDIO') {
        if (!TIPOS_AUDIO_PERMITIDOS.includes(media.mime) || media.buffer.length > MAX_AUDIO_BYTES) return { ok: false, motivo: 'El audio no es válido o pesa demasiado' };
        const sub = await this.archivosService.subirAudio(media.buffer, media.mime);
        nuevo = { audio: { archivoId: sub.id, mime: media.mime }, clase: 'NOTA_DE_VOZ' };
      } else {
        const v = validarDocumento(media.nombre || nombreSegunMime(media.mime), media.mime);
        if (!v.ok || media.buffer.length > MAX_DOCUMENTO_BYTES || !contenidoCoincide(media.buffer, v.ext)) return { ok: false, motivo: 'El documento no es de un tipo permitido' };
        const sub = await this.archivosService.subirDocumento(media.buffer, v.mime, v.nombre);
        nuevo = { texto: textoDocumentoChat(v.nombre, media.buffer.length), documento: { archivoId: sub.id, nombre: v.nombre, mime: v.mime, bytes: media.buffer.length } };
      }
      await this.prisma.mensajeChat.update({ where: { id: m.id }, data: { contenido: { ...c, ...nuevo } as any } });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: m.conversacion_id.toString() });
      this.logger.log(`Archivo recuperado de un mensaje (${m.tipo}, ${media.buffer.length} bytes)`);
      return { ok: true };
    } catch (err: any) {
      this.logger.warn(`No se pudo recuperar el archivo de un mensaje: ${err.message}`);
      return { ok: false, motivo: 'No se pudo recuperar el archivo' };
    }
  }

  /**
   * Admin: una foto del chat que no se ligó sola pasa a ser voucher del pedido elegido (mismo camino que al llegar:
   * pago en el chat, aviso a Caja, análisis y semáforo). El pedido debe ser del mismo cliente.
   */
  async asignarImagenComoVoucher(
    mensajeId: bigint,
    pedidoId: bigint,
    usuario: any,
    ip?: string,
    dispositivo?: string,
  ): Promise<{ ok: true; codigo: string }> {
    const m = await this.prisma.mensajeChat.findUnique({ where: { id: mensajeId }, include: { conversacion: true } });
    const archivoId = (m?.contenido as any)?.archivoId;
    if (!m || m.tipo !== 'IMAGEN' || m.direccion !== 'ENTRA' || !archivoId) {
      throw new BadRequestException({ codigo: 'FOTO_NO_DISPONIBLE', mensaje: 'Esta foto no está guardada: usa «Recuperar archivo» primero' });
    }
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, estado: { not: 'ANULADO' }, es_personal: false },
      select: SELECT_PEDIDO_VOUCHER,
    });
    const fin = ultimos9(m.conversacion.telefono);
    if (!pedido || (fin && ultimos9(pedido.cliente_telefono) !== fin)) {
      throw new BadRequestException({ codigo: 'PEDIDO_NO_VALIDO', mensaje: 'Elige un pedido de este cliente' });
    }
    const f = await this.archivosService.obtenerArchivoPrivado(String(archivoId), usuario, ip, dispositivo);
    const buffer = await readFile(f.rutaAbsoluta);
    await this.ligarVoucherGuardado(buffer, f.tipoMime, String(archivoId), pedido, enmascararTelefono(m.conversacion.telefono), m.conversacion, m.id);
    return { ok: true, codigo: pedido.codigo };
  }

  /**
   * Calificación de la encuesta posventa. Solo cuenta una calificación explícita (ver interpretarPuntajeEncuesta)
   * y solo contra la encuesta ENVIADA más reciente de ese teléfono dentro de encuesta_ventana_dias.
   * Devuelve true si el mensaje fue la calificación: queda consumido y el bot no contesta.
   */
  private async procesarPosibleEncuesta(
    telHash: string,
    telMask: string,
    texto: string,
    buttonPayload: string | null,
    telefonoNorm: string | null,
    conversacion: any,
  ): Promise<boolean> {
    if (telefonoNorm && (await this.procesarMotivoEncuesta(telMask, texto, buttonPayload, telefonoNorm, conversacion))) {
      return true;
    }
    const puntaje = interpretarPuntajeEncuesta(buttonPayload) ?? interpretarPuntajeEncuesta(texto);
    if (puntaje === null || !telefonoNorm) return false;

    const ventanaDias = await leerParametroNumerico(this.prisma, 'encuesta_ventana_dias', 7);
    const encuesta = await this.prisma.encuestaPosventa.findFirst({
      where: {
        estado: 'ENVIADA',
        enviada_en: { gte: new Date(Date.now() - ventanaDias * 24 * 3600 * 1000) },
        pedido: { cliente_telefono: { contains: telefonoNorm.slice(-8) } },
      },
      orderBy: { enviada_en: 'desc' },
      include: { pedido: { select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true } } },
    });
    if (!encuesta) return false;

    const umbralQueja = await leerParametroNumerico(this.prisma, 'encuesta_puntaje_queja', 2);
    const esBaja = puntaje <= umbralQueja;
    const preguntaMotivo = puntaje <= 3;
    const { pedido } = encuesta;
    const nombreCliente =
      (conversacion ? obtenerNombreMostrar(conversacion) : null) || pedido.cliente_nombre || telMask;
    const tituloNotif = `Calificación baja: ${puntaje}/5 · ${pedido.codigo} · ${nombreCliente}`;
    const enlaceMensajes = `/admin/mensajes?telefono=${telefonoNorm.slice(-9)}`;

    // Todo en una transacción. El UPDATE condicionado a ENVIADA hace que la misma calificación se aplique una sola vez.
    const aplicada = await this.prisma.$transaction(async (tx) => {
      const r = await tx.encuestaPosventa.updateMany({
        where: { id: encuesta.id, estado: 'ENVIADA' },
        data: {
          puntaje,
          respondida_en: new Date(),
          estado: 'RESPONDIDA',
          // 1-3: se pregunta el porqué; el agradecimiento sale después de la respuesta
          ...(preguntaMotivo ? { motivo_preguntado_en: new Date() } : {}),
        },
      });
      if (r.count === 0) return null;

      let notifId: bigint | null = null;
      let quejaId: bigint | null = null;
      if (esBaja) {
        const queja = await tx.quejaWhatsapp.create({
          data: {
            origen: 'ENCUESTA',
            pedido_id: pedido.id,
            cliente: nombreCliente,
            telefono_hash: telHash,
            puntaje,
            texto: `Calificación baja en encuesta posventa (${puntaje}/5)`,
            estado: 'NUEVA',
          },
        });
        quejaId = queja.id;

        // ADMIN ve todas las notificaciones; CAJERO ve las dirigidas a su rol. Una sola fila, sin duplicar.
        const notif = await tx.notificacion.create({
          data: {
            tipo: 'QUEJA_WHATSAPP',
            rol_destino: 'CAJERO',
            titulo: tituloNotif,
            mensaje: `El cliente de pedido ${pedido.codigo} calificó con ${puntaje}/5. Una persona le escribirá por el chat.`,
            enlace: enlaceMensajes,
          },
        });
        notifId = notif.id;

        // El chat pasa a una persona: el bot deja de contestar hasta que alguien de Caja o admin responda.
        await tx.conversacion.update({
          where: { id: conversacion.id },
          data: {
            duenio: 'PERSONA',
            urgente: true,
            motivo_derivacion: 'CALIFICACION_BAJA',
            ultima_actividad: new Date(),
            ...(conversacion.estado === 'VALIDAR_PAGO' ? {} : { estado: 'ABIERTA' }),
          },
        });
      }

      if (this.outbox) {
        await this.outbox.encolar(
          {
            telefono: telefonoNorm,
            tipo: 'TEXTO',
            clave: `encuesta-${encuesta.id}-${preguntaMotivo ? 'MOTIVO' : 'GRACIAS'}`,
            origen: 'ENCUESTA',
            pedidoId: pedido.id,
            carga: {
              ...(preguntaMotivo
                ? textoPreguntaMotivo(nombreCliente, pedido.codigo)
                : textoGraciasEncuesta(puntaje, umbralQueja, nombreCliente, pedido.codigo)),
              autor: 'BOT',
              nombre: nombreCliente,
              pedidoCodigo: pedido.codigo,
              etapa: 'ENCUESTA',
            },
          },
          tx,
        );
      }

      return { notifId, quejaId };
    });

    // Ya estaba contestada: el mensaje sigue siendo una calificación, pero no se repite nada.
    if (!aplicada) return true;

    this.outbox?.despertar();

    if (aplicada.notifId) {
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: aplicada.notifId.toString(), titulo: tituloNotif });
    }

    if (esBaja) {
      this.logger.log(`Queja de WhatsApp creada id ${aplicada.quejaId} para pedido ${pedido.codigo}`);
      try {
        await this.avisosInternosService?.avisarCalificacionBaja({
          encuestaId: encuesta.id,
          codigo: pedido.codigo,
          cliente: nombreCliente,
          puntaje,
          telefono: telefonoNorm,
        });
      } catch (err: any) {
        this.logger.error(`No se pudo avisar a administradores de la calificación baja: ${err.message}`);
      }
    }

    return true;
  }

  /**
   * Respuesta al «¿qué fue lo que no salió bien?» de una calificación 1-3: fila de la lista («motivo:CODIGO») o,
   * tras elegir «Otro», el texto libre. Vale 24 h desde la pregunta; sin respuesta no se insiste. El mensaje queda
   * consumido (no es pedido ni nota). Un texto suelto sin haber elegido «Otro» sigue su camino normal.
   */
  private async procesarMotivoEncuesta(
    telMask: string,
    texto: string,
    buttonPayload: string | null,
    telefonoNorm: string,
    conversacion: any,
  ): Promise<boolean> {
    const encuesta = await this.prisma.encuestaPosventa.findFirst({
      where: {
        estado: 'RESPONDIDA',
        motivo_preguntado_en: { gte: new Date(Date.now() - MOTIVO_VENCE_MS) },
        OR: [{ motivo_codigo: null }, { motivo_codigo: 'OTRO', motivo_texto: null }],
        pedido: { cliente_telefono: { contains: telefonoNorm.slice(-8) } },
      },
      orderBy: { motivo_preguntado_en: 'desc' },
      include: { pedido: { select: { id: true, codigo: true, cliente_nombre: true } } },
    });
    if (!encuesta || encuesta.puntaje == null) return false;

    const elegido = interpretarMotivoEncuesta(buttonPayload);
    const esperaTexto = encuesta.motivo_codigo === 'OTRO';
    const libre = !buttonPayload ? texto.trim().slice(0, MOTIVO_TEXTO_MAX) : '';
    if (!elegido && !(esperaTexto && libre)) return false;

    const { pedido } = encuesta;
    const nombreCliente =
      (conversacion ? obtenerNombreMostrar(conversacion) : null) || pedido.cliente_nombre || telMask;
    const sinMotivoAun = { id: encuesta.id, OR: [{ motivo_codigo: null }, { motivo_codigo: 'OTRO', motivo_texto: null }] };

    // «Otro»: falta lo que escriba el cliente
    if (elegido === 'OTRO') {
      if (encuesta.motivo_codigo === 'OTRO') return true; // ya se le pidió el texto
      await this.prisma.$transaction(async (tx) => {
        const r = await tx.encuestaPosventa.updateMany({
          where: { id: encuesta.id, motivo_codigo: null },
          data: { motivo_codigo: 'OTRO' },
        });
        if (r.count === 0 || !this.outbox) return;
        await this.outbox.encolar(
          {
            telefono: telefonoNorm,
            tipo: 'TEXTO',
            clave: `encuesta-${encuesta.id}-MOTIVO-LIBRE`,
            origen: 'ENCUESTA',
            pedidoId: pedido.id,
            carga: { textoLibre: TEXTO_PIDE_MOTIVO_LIBRE, autor: 'BOT', nombre: nombreCliente, pedidoCodigo: pedido.codigo, etapa: 'ENCUESTA' },
          },
          tx,
        );
      });
      this.outbox?.despertar();
      return true;
    }

    const codigo = elegido ?? 'OTRO';
    const motivoTexto = elegido ? null : libre;
    const etiqueta = etiquetaMotivo(codigo, motivoTexto) ?? codigo;
    const umbralQueja = await leerParametroNumerico(this.prisma, 'encuesta_puntaje_queja', 2);

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.encuestaPosventa.updateMany({
        where: sinMotivoAun,
        data: { motivo_codigo: codigo, motivo_texto: motivoTexto },
      });
      if (r.count === 0) return;
      // Con queja (nota ≤ umbral) el equipo ve el motivo también ahí
      if (encuesta.puntaje! <= umbralQueja) {
        await tx.quejaWhatsapp.updateMany({
          where: { pedido_id: pedido.id, origen: 'ENCUESTA' },
          data: { motivo: etiqueta, texto: `Calificación baja en encuesta posventa (${encuesta.puntaje}/5). Motivo: ${etiqueta}` },
        });
      }
      await this.outbox?.encolar(
        {
          telefono: telefonoNorm,
          tipo: 'TEXTO',
          clave: `encuesta-${encuesta.id}-GRACIAS`,
          origen: 'ENCUESTA',
          pedidoId: pedido.id,
          carga: {
            ...textoGraciasEncuesta(encuesta.puntaje!, umbralQueja, nombreCliente, pedido.codigo),
            autor: 'BOT',
            nombre: nombreCliente,
            pedidoCodigo: pedido.codigo,
            etapa: 'ENCUESTA',
          },
        },
        tx,
      );
    });
    this.outbox?.despertar();
    return true;
  }

  /**
   * Procesa el cuerpo completo del Webhook de WhatsApp de forma asíncrona y segura.
   */
  /**
   * Numero de la cuenta que recibio el evento (metadata del payload firmado). Solo cifras: otra cosa se omite con log.
   * Si WHATSAPP_PHONE_IDS_EXTRA esta definida, solo valen WHATSAPP_PHONE_ID y esos; si no, cualquier numero de la
   * cuenta firmada (asi el numero antiguo funciona sin configurar nada). Sin metadata: numero de siempre.
   */
  private receptorDe(metadata: any): ReceptorWhatsapp | undefined | 'OMITIR' {
    const id = String(metadata?.phone_number_id ?? '').trim();
    if (!id) return undefined;
    const principal = (this.configService.get<string>('WHATSAPP_PHONE_ID', '') ?? '').trim();
    const extra = (this.configService.get<string>('WHATSAPP_PHONE_IDS_EXTRA', '') ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const permitido = !/^[0-9]{5,25}$/.test(id) ? false : !extra.length || id === principal || extra.includes(id);
    if (!permitido) {
      this.logger.warn(`Evento de WhatsApp omitido: numero receptor no permitido (${id.slice(0, 30)})`);
      return 'OMITIR';
    }
    const display = String(metadata?.display_phone_number ?? '').replace(/[^0-9+]/g, '').slice(0, 20);
    return { id, display: display || undefined };
  }

  /** Remitente propio del negocio o bloqueado: se ignora en silencio (sin conversación, sin respuesta, sin contar spam ni guardar contenido). */
  private async remitenteOmitido(msg: any, contacts: any[] = []): Promise<boolean> {
    if (!this.numeros) return false;
    const de = String(msg?.from || contacts?.[0]?.wa_id || '');
    const motivo = await this.numeros.motivoOmision(de);
    if (!motivo) return false;
    this.numeros.logOmitido(motivo, de, 'webhook_entrante');
    return true;
  }

  /** Espera entre intentos de reconocer el eco de un envío del sistema (la respuesta de Evolution y su webhook se cruzan). */
  esperaEcoMs = 700;

  /** ¿Ese id de WhatsApp es de un mensaje que envió o guardó nuestro sistema (bot, avisos, panel Mensajes)? Lo contrario: lo escribió una persona. */
  private async esMensajeDelSistema(waId: string): Promise<boolean> {
    for (let i = 0; i < 4; i++) {
      const [a, b, c] = await Promise.all([
        this.prisma.whatsappMensaje.findUnique({ where: { wa_message_id: waId }, select: { id: true } }),
        this.prisma.mensajeChat.findUnique({ where: { meta_id: waId }, select: { id: true } }),
        this.prisma.salienteWhatsapp.findFirst({ where: { wa_message_id: waId }, select: { id: true } }),
      ]);
      if (a || b || c) return true;
      if (i < 3 && this.esperaEcoMs > 0) await new Promise((ok) => setTimeout(ok, this.esperaEcoMs));
    }
    return false;
  }

  /**
   * Mensaje que una persona del local escribió desde WhatsApp Business (Evolution: messages.upsert con fromMe). Si el id no es de un
   * envío nuestro: se guarda en el chat como «Enviado desde WhatsApp Business por el local» (autor PERSONA) y el chat pasa a
   * «atiende una persona» (duenio PERSONA): el bot calla 2 h desde ese mensaje, hasta Atendido o «Devolver al bot». Nunca lanza.
   */
  async registrarMensajeDelLocal(msg: any): Promise<'GUARDADO' | 'SISTEMA' | 'OMITIDO'> {
    try {
      const waId = String(msg?.id ?? '').trim();
      const rawFrom = String(msg?.from ?? '').trim();
      if (!waId || !rawFrom) return 'OMITIDO';
      if (await this.remitenteOmitido(msg)) return 'OMITIDO';
      if (await this.esMensajeDelSistema(waId)) return 'SISTEMA';

      const identificador = /^\+?\d{7,15}$/.test(rawFrom) ? normalizarTelefono(rawFrom) : `wa-user:${rawFrom}`;
      const tipo = String(msg.type ?? '');
      const clase = tipo === 'image' ? 'IMAGEN' : tipo === 'audio' ? 'AUDIO' : tipo === 'document' ? 'DOCUMENTO' : 'TEXTO';
      const pie = String(msg.image?.caption ?? msg.document?.caption ?? '').trim();
      const texto =
        tipo === 'text' ? String(msg.text?.body ?? '').trim()
        : tipo === 'image' ? pie || 'Foto'
        : tipo === 'audio' ? 'Nota de voz'
        : tipo === 'document' ? String(msg.document?.filename ?? pie ?? '').trim() || 'Documento'
        : tipo === 'location' ? String(msg.location?.address ?? msg.location?.name ?? 'Ubicación').trim()
        : tipo === 'reaction' ? '' : tipo === 'sticker' ? 'Sticker' : tipo === 'video' ? 'Video' : 'Mensaje';
      // Una reacción no es una respuesta ni interrumpe al bot
      if (tipo === 'reaction' || (!texto && clase === 'TEXTO')) return 'OMITIDO';

      const conv = await this.chatDelMensajeDelLocal(identificador);
      const datos: any = { duenio: 'PERSONA', ultima_actividad: new Date() };
      const conversacion = conv
        ? await this.prisma.conversacion.update({ where: { id: conv.id }, data: datos })
        : await this.prisma.conversacion.create({
            data: { telefono: identificador, ...datos, estado: 'ABIERTA', identificador_tipo: identificador.startsWith('wa-user:') ? 'USUARIO_WA' : 'TELEFONO' },
          });
      const m = await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: conversacion.id,
          direccion: 'SALE',
          autor: 'PERSONA',
          tipo: clase,
          contenido: { texto, canal: CANAL_WHATSAPP_BUSINESS, waMessageId: waId, ...(tipo === 'location' ? { ubicacion: { lat: Number(msg.location?.latitude), lng: Number(msg.location?.longitude) } } : {}) },
          meta_id: waId,
        },
      });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });
      if (clase !== 'TEXTO') void this.recuperarArchivoDeMensaje(m.id);
      return 'GUARDADO';
    } catch (err: any) {
      // meta_id único: el mismo mensaje entregado dos veces no se duplica
      if (err?.code !== 'P2002') this.logger.warn(`No se pudo guardar un mensaje del local: ${err?.message}`);
      return 'OMITIDO';
    }
  }

  /**
   * Chat al que va lo que el local escribe desde WhatsApp Business. WhatsApp a veces lo reporta con el número aunque el chat
   * entró como LID (o al revés): sin este cruce la respuesta caía en un chat nuevo y en el chat real no se veía.
   */
  private async chatDelMensajeDelLocal(identificador: string) {
    const directo = await this.prisma.conversacion.findUnique({ where: { telefono: identificador } });
    if (directo) return directo;
    if (identificador.startsWith('wa-user:')) {
      // LID → celular aprendido (Redis o el propio chat) → chat de ese celular
      const lid = identificador.replace(/\D/g, '');
      const cel = this.redis ? await this.redis.obtenerCliente().get(claveParLidCelular(lid)).catch(() => null) : null;
      return cel ? this.prisma.conversacion.findUnique({ where: { telefono: normalizarTelefono(cel) } }) : null;
    }
    // Número → chat que entró como LID y quedó vinculado a ese celular
    return this.prisma.conversacion.findFirst({ where: { celular_vinculado: identificador.slice(-9) }, orderBy: { ultima_actividad: 'desc' } });
  }

  /**
   * Une un chat que llegó como LID (sin número) con el celular real. Si no hay chat con ese celular, el chat del LID pasa a ser
   * el del celular (se le escribe a ese número); si ya existen los dos, el del LID guarda el celular vinculado para que sus pedidos
   * y el botón «Abrir chat» del pedido lo encuentren. No registra números en logs. Nunca lanza.
   */
  async vincularLidConCelular(lid: string, celular: string): Promise<boolean> {
    try {
      const dl = String(lid).replace(/\D/g, '');
      const dc = String(celular).replace(/\D/g, '');
      if (!dl || !/^\d{9,15}$/.test(dc) || dl === dc) return false;
      const tel = normalizarTelefono(dc);
      // El par se guarda aunque todavía no haya chat con ese LID: la próxima verificación sin número lo encuentra
      if (this.redis) await this.redis.obtenerCliente().set(claveParLidCelular(dl), tel.slice(-9), 'EX', PAR_LID_TTL_SEG).catch(() => undefined);
      const delLid = await this.prisma.conversacion.findUnique({ where: { telefono: `wa-user:${dl}@lid` }, select: { id: true, celular_vinculado: true } });
      if (!delLid) return false;
      const delTel = await this.prisma.conversacion.findUnique({ where: { telefono: tel }, select: { id: true } });
      if (!delTel) {
        await this.prisma.conversacion.update({ where: { id: delLid.id }, data: { telefono: tel, identificador_tipo: 'TELEFONO', celular_vinculado: null } });
      } else if (delLid.celular_vinculado !== tel.slice(-9)) {
        await this.prisma.conversacion.update({ where: { id: delLid.id }, data: { celular_vinculado: tel.slice(-9) } });
      } else return false;
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: delLid.id.toString() });
      return true;
    } catch (err: any) {
      this.logger.warn(`No se pudo vincular un chat sin número: ${err?.message}`);
      return false;
    }
  }

  /** El local leyó el chat en WhatsApp Business (chats.update sin mensajes por leer): queda visto en Mensajes. */
  async marcarLeidoDesdeWhatsapp(jid: string): Promise<boolean> {
    try {
      const dig = jid.replace(/\D/g, '');
      if (!dig || jid.endsWith('@g.us')) return false;
      const ids = jid.endsWith('@lid') ? [`wa-user:${dig}@lid`] : [normalizarTelefono(dig), dig];
      const c = await this.prisma.conversacion.findFirst({ where: { telefono: { in: ids } }, select: { id: true } });
      if (!c) return false;
      await this.prisma.conversacion.update({ where: { id: c.id }, data: { visto_en: new Date(), marcado_no_visto: false } });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: c.id.toString() });
      return true;
    } catch (err: any) {
      this.logger.warn(`No se pudo marcar leído desde WhatsApp: ${err?.message}`);
      return false;
    }
  }

  async procesarPayload(payload: any) {
    if (!payload || payload.object !== 'whatsapp_business_account') {
      return { procesados: 0, estados: 0 };
    }

    let mensajesProcesados = 0;
    let estadosProcesados = 0;

    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const val = change.value;
        if (!val) continue;

        const receptor = this.receptorDe(val.metadata);
        if (receptor === 'OMITIR') continue;
        if (receptor?.display) this.numeros?.aprenderNumeroVisible(receptor.display);

        // 1. Estados de entrega (sent, delivered, read, failed)
        if (Array.isArray(val.statuses)) {
          for (const status of val.statuses) {
            await this.procesarEstado(status);
            estadosProcesados++;
          }
        }

        // 2. Mensajes entrantes
        if (Array.isArray(val.messages)) {
          for (const msg of val.messages) {
            // Anti-bucle: ni el propio número del negocio (auto-mensajes, ecos) ni los bloqueados llegan al bot
            if (change.field === 'smb_message_echoes' || (await this.remitenteOmitido(msg, val.contacts))) continue;
            const nuevo = await this.procesarMensajeEntrante(msg, val.contacts, receptor);
            if (nuevo) mensajesProcesados++;
          }
        }
      }
    }

    return { procesados: mensajesProcesados, estados: estadosProcesados };
  }
}
