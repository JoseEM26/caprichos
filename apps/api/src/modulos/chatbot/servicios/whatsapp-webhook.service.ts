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
import { marcarPagoParaPersona } from './pago-para-persona.util';
import { pedidoEsperandoVoucher } from './pedido-esperando-voucher.util';
import { OutboxWhatsappService } from './outbox-whatsapp.service';
import { interpretarPuntajeEncuesta } from './encuesta-posventa.util';
import { ubicacionValida, UbicacionCliente } from './ubicacion-cliente.util';
import { DireccionesService } from '../../direcciones/direcciones.service';
import { atenderMensajeVerificacion, secretoVerificacion } from '../../clientes/verificacion-whatsapp.util';
import { textoGraciasEncuesta } from '../conversacion/textos-encuesta';
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

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024; // 5 MB
export const TIPOS_MEDIA_PERMITIDOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

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
  private async descargarMediaSegura(
    mediaId: string,
    mimeType: string,
  ): Promise<Buffer | null> {
    if (!this.waToken) {
      this.logger.warn('Sin WHATSAPP_TOKEN para descargar archivo adjunto.');
      return null;
    }

    if (!TIPOS_MEDIA_PERMITIDOS.includes(mimeType)) {
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

      const arrayBuffer = await resDownload.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > MAX_MEDIA_BYTES) {
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
  private async procesarMensajeEntrante(msg: any, contacts: any[] = []) {
    // Un solo mensaje por conversación a la vez: el toque rápido espera al anterior y lee el estado ya guardado.
    const de = String(msg?.from || msg?.from_user_id || contacts?.[0]?.wa_id || msg?.id || '').replace(/\D/g, '') || String(msg?.from_user_id || msg?.id || 'anon');
    let redisCliente: any = null;
    try { redisCliente = this.redis?.obtenerCliente() ?? null; } catch { redisCliente = null; }
    return ejecutarEnSerie(`wa:${de}`, redisCliente, () => this.procesarMensajeEntranteSerie(msg, contacts));
  }

  private async procesarMensajeEntranteSerie(msg: any, contacts: any[] = []) {
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
      // NO_COMPATIBLE (audio, video, sticker, documento...): no se descarga ni se pasa al motor.
      tipoRegistro = 'OTRO';
      texto = clasificacion.etiqueta;
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

      conversacion = await this.prisma.conversacion.update({
        where: { id: conversacion.id },
        data: dataUpdate,
      });
    }

    // 1. Detección de consentimiento Ley 29733 (BAJA / STOP / NO MAS / ALTA)
    const textoNorm = texto.toLowerCase().trim();
    if (textoNorm === 'baja' || textoNorm === 'stop' || textoNorm === 'no mas') {
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
    const pedidoReciente = telefonoNorm
      ? await this.prisma.pedido.findFirst({
          where: {
            OR: [
              { cliente_telefono: { contains: telefonoNorm.slice(-8) } },
              { cliente_telefono: telefonoNorm },
            ],
          },
          orderBy: { creado_en: 'desc' },
          select: { id: true, codigo: true, cliente_nombre: true, estado: true, modalidad: true },
        })
      : null;

    // 5. Procesamiento de imagen de voucher
    let archivoMensajeId: string | null = null;
    // El voucher se liga al pedido que espera pago (no al último pedido del cliente, que puede estar cerrado)
    const pedidoVoucher = imagenBuffer && telefonoNorm
      ? await pedidoEsperandoVoucher(this.prisma, conversacion?.flujo, telefonoNorm)
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
    const ubicacionGuardada: UbicacionCliente | null =
      ubicacion && ubicacionValida(ubicacion.latitud, ubicacion.longitud)
        ? { lat: ubicacion.latitud, lng: ubicacion.longitud, nombre: ubicacion.nombre, direccion: ubicacion.direccion }
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
            : esNoCompatible
              ? { texto, clase: clasificacion.clase, subtipo: clasificacion.subtipo, etiqueta: clasificacion.etiqueta, waMessageId: waMessageId || null }
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
    if (clasificacion.clase === 'TEXTO' && telefonoNorm && !(await this.spamBloqueado(identificador))) {
      if (await this.atenderVerificacionCelular(telefonoNorm, texto)) return true;
    }

    // Audio, video, sticker, documento, etc.: no avanzan el flujo ni cuentan como calificación, reprogramación o voucher.
    // El bot avisa y repite el paso (ver atenderNoCompatible).
    if (esNoCompatible) {
      await this.atenderNoCompatible({
        conversacion,
        clasificacion,
        identificador,
        telefonoNorm,
        telHash,
        waMessageId,
      });
      return true;
    }

    // Acuse del voucher por el outbox (registrado en el chat). No aprueba nada: Caja revisa el pago.
    if (voucherAtendido && pedidoVoucher && telefonoNorm && this.outbox) {
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

    // 6. Invocación segura del motor de conversación (Ola 1 Agente B)
    // El bot responde únicamente si la conversación le pertenece y el cliente no solicitó baja/alta
    const esComandoBajaOAlta =
      textoNorm === 'baja' ||
      textoNorm === 'stop' ||
      textoNorm === 'no mas' ||
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

    if (
      this.motorConversacion &&
      !esComandoBajaOAlta &&
      puedeProcesarMotor &&
      !reprogramacionAtendida &&
      !encuestaAtendida &&
      !voucherAtendido
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
          );
        }
      }
    }

    return true;
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
      const aviso = textoAvisoNoCompatible(p.clasificacion.subtipo, esperaVoucher);
      // Si el último mensaje del bot tenía botones o lista, se repite con ellos reales; si no, texto con viñetas
      const interactivo = interactivoDesdeContenido(prompt, aviso);

      await this.outbox.encolar({
        telefono: p.identificador,
        tipo: interactivo ? 'INTERACTIVO' : 'TEXTO',
        clave: `no-compatible-${p.waMessageId || `${p.identificador}-${Date.now()}`}`,
        origen: ORIGEN_NO_COMPATIBLE,
        carga: {
          textoLibre: repeticion ? `${aviso}\n\n${repeticion}` : aviso,
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
   * Responde a un mensaje de verificación del celular. Devuelve true si el mensaje era de verificación (y ya
   * se respondió), false si es un mensaje normal. Un fallo interno no pasa el mensaje al bot: no se contesta nada.
   */
  private async atenderVerificacionCelular(telefonoNorm: string, texto: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const respuesta = await atenderMensajeVerificacion(
        this.redis.obtenerCliente(),
        secretoVerificacion(this.configService),
        texto,
        telefonoNorm,
      );
      if (!respuesta) return false;
      // Dentro de la ventana de 24 h (el cliente acaba de escribir): texto libre, sin plantilla
      await this.mensajeria.enviarTexto(telefonoNorm, respuesta);
    } catch (err: any) {
      this.logger.warn(`No se pudo atender la verificación del celular: ${err.message}`);
    }
    return true;
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

      // Enlazar captura a la conversación y al pedido (estado VALIDAR_PAGO)
      if (conversacion?.id) {
        const flujoActual = (conversacion.flujo as any) || {};
        const pagoPrev = flujoActual.pago || {};
        const capturasEnviadas = (pagoPrev.capturasEnviadas || 0) + 1;

        await marcarPagoParaPersona(this.prisma, conversacion, pedido, {
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
            .registrarDesdeWhatsapp(
              buffer,
              mimeType,
              archivoSubido.id,
              pedido,
              conversacion,
            )
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

      return String(archivoSubido.id);
    } catch (err: any) {
      this.logger.error(`Error guardando comprobante privado: ${err.message}`);
      return null;
    }
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
    const { pedido } = encuesta;
    const nombreCliente =
      (conversacion ? obtenerNombreMostrar(conversacion) : null) || pedido.cliente_nombre || telMask;
    const tituloNotif = `Calificación baja: ${puntaje}/5 · ${pedido.codigo} · ${nombreCliente}`;
    const enlaceMensajes = `/admin/mensajes?telefono=${telefonoNorm.slice(-9)}`;

    // Todo en una transacción. El UPDATE condicionado a ENVIADA hace que la misma calificación se aplique una sola vez.
    const aplicada = await this.prisma.$transaction(async (tx) => {
      const r = await tx.encuestaPosventa.updateMany({
        where: { id: encuesta.id, estado: 'ENVIADA' },
        data: { puntaje, respondida_en: new Date(), estado: 'RESPONDIDA' },
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
            clave: `encuesta-${encuesta.id}-GRACIAS`,
            origen: 'ENCUESTA',
            pedidoId: pedido.id,
            carga: {
              ...textoGraciasEncuesta(puntaje, umbralQueja, nombreCliente, pedido.codigo),
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
   * Procesa el cuerpo completo del Webhook de WhatsApp de forma asíncrona y segura.
   */
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
            const nuevo = await this.procesarMensajeEntrante(msg, val.contacts);
            if (nuevo) mensajesProcesados++;
          }
        }
      }
    }

    return { procesados: mensajesProcesados, estados: estadosProcesados };
  }
}
