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
import {
  limpiarNombrePerfil,
  obtenerNombreMostrar,
} from '../../mensajes/utilidades/nombre-contacto.util';
import { VouchersService } from '../../vouchers/vouchers.service';
import { EjecutorConversacionService } from '../conversacion/ejecutor-conversacion.service';
import { AvisosInternosService } from '../avisos-internos/avisos-internos.service';

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
      errorDetalle = String(err.title || err.message || '');
    }

    try {
      await this.prisma.whatsappMensaje.updateMany({
        where: { wa_message_id: waMessageId },
        data: {
          estado: estadoFinal,
          ...(errorCodigo ? { error_codigo: errorCodigo } : {}),
          ...(errorDetalle ? { error_detalle: errorDetalle } : {}),
        },
      });

      const waMsg = await this.prisma.whatsappMensaje.findFirst({
        where: { wa_message_id: waMessageId },
        select: { conversacion_id: true },
      });

      if (waMsg?.conversacion_id) {
        this.eventos?.emitirAdmin('mensajes:actualizado', {
          id: waMsg.conversacion_id.toString(),
        });
      }
    } catch (err: any) {
      this.logger.error(`Error actualizando estado para waMessageId ${waMessageId}: ${err.message}`);
    }
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

    if (tipo === 'text') {
      texto = String(msg.text?.body || '').trim();
      tipoRegistro = 'TEXTO';
    } else if (tipo === 'button') {
      texto = String(msg.button?.text || '').trim();
      buttonPayload = String(msg.button?.payload || texto).trim();
      tipoRegistro = 'BOTON';
    } else if (tipo === 'interactive') {
      tipoRegistro = 'BOTON';
      if (msg.interactive?.type === 'button_reply') {
        buttonPayload = String(msg.interactive.button_reply.id || '').trim();
        texto = String(msg.interactive.button_reply.title || '').trim();
      } else if (msg.interactive?.type === 'list_reply') {
        buttonPayload = String(msg.interactive.list_reply.id || '').trim();
        texto = String(msg.interactive.list_reply.title || '').trim();
      }
    } else if (tipo === 'location') {
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
      texto = locDir || locNombre || `Ubicación compartida: ${lat}, ${lng}`;
    } else if (tipo === 'image') {
      tipoRegistro = 'IMAGEN';
      texto = String(msg.image?.caption || '[Imagen de comprobante adjunta]').trim();
      imagenMime = msg.image?.mime_type || 'image/jpeg';
      if (msg.image?.id) {
        imagenBuffer = await this.descargarMediaSegura(msg.image.id, imagenMime);
      }
    } else {
      tipoRegistro = 'OTRO';
      texto = `[Mensaje de tipo ${tipo}]`;
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

    // 3. Procesamiento de encuesta posventa
    await this.procesarPosibleEncuesta(telHash, telMask, texto, buttonPayload, pedidoReciente, conversacion);

    // 4. Procesamiento de respuesta a reprogramación (solo con teléfono)
    if (telefonoNorm) {
      await this.procesarPosibleReprogramacion(texto, buttonPayload, pedidoReciente, telMask, telefonoNorm);
    }

    // 5. Procesamiento de imagen de voucher
    let archivoMensajeId: string | null = null;
    if (imagenBuffer && pedidoReciente) {
      archivoMensajeId = await this.guardarVoucherPrivado(imagenBuffer, imagenMime, pedidoReciente, telMask, conversacion);
    } else if (imagenBuffer) {
      // Imagen sin pedido asociado: igual se guarda en privado para que el equipo la vea en el chat
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
      } catch (err: any) {
        this.logger.warn(`No se pudo guardar la imagen del chat: ${err.message}`);
      }
    }

    // Registrar mensaje en mensaje_chat del módulo de mensajes
    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacion.id,
        direccion: 'ENTRA',
        autor: 'CLIENTE',
        tipo: tipoRegistro === 'IMAGEN' ? 'IMAGEN' : 'TEXTO',
        contenido: archivoMensajeId ? { texto, archivoId: archivoMensajeId } : { texto },
        meta_id: waMessageId || null,
      },
    });

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

    // 6. Invocación segura del motor de conversación (Ola 1 Agente B)
    // El bot responde únicamente si la conversación le pertenece y el cliente no solicitó baja/alta
    const esComandoBajaOAlta =
      textoNorm === 'baja' ||
      textoNorm === 'stop' ||
      textoNorm === 'no mas' ||
      textoNorm === 'alta' ||
      textoNorm === 'start';

    if (this.motorConversacion && !esComandoBajaOAlta && conversacion.duenio === 'BOT') {
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

        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            estado: 'VALIDAR_PAGO',
            // Con un voucher por revisar la conversación pasa a una persona de Caja: el bot ya no decide
            duenio: 'PERSONA',
            urgente: true,
            flujo: {
              ...flujoActual,
              pago: {
                ...pagoPrev,
                pedidoId: pedido.id.toString(),
                pedidoCodigo: pedido.codigo,
                medio: pedido.pago_preferido || pedido.pago_metodo,
                monto: Number(pedido.total || 0),
                comprobanteArchivoId: archivoSubido.id,
                capturasEnviadas,
                timestampUltimoVoucher: Date.now(),
              },
            },
          },
        });
      }

      // Notificación de campana a Caja
      const tituloNotif = 'Comprobante de pago recibido';
      const mensajeNotif = `El cliente (${telMask}) envio un comprobante para el pedido ${pedido.codigo}.`;

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'COMPROBANTE_RECIBIDO',
          rol_destino: 'CAJA',
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
   * Verifica si el mensaje entrante corresponde a la respuesta de una encuesta posventa.
   */
  private async procesarPosibleEncuesta(
    telHash: string,
    telMask: string,
    texto: string,
    buttonPayload: string | null,
    pedido: any,
    conversacion?: any,
  ) {
    if (!pedido) return;

    // Buscar encuesta pendiente de respuesta para este pedido
    const encuesta = await this.prisma.encuestaPosventa.findUnique({
      where: { pedido_id: pedido.id },
    });

    if (!encuesta || encuesta.estado === 'RESPONDIDA') {
      return;
    }

    let puntaje: number | null = null;
    const candidato = (buttonPayload || texto).trim();

    // Comprobar formato de botón "encuesta:X" o dígito directo 1..5 o textos
    if (/^encuesta:([1-5])$/.test(candidato)) {
      puntaje = parseInt(candidato.replace('encuesta:', ''), 10);
    } else if (/^[1-5]$/.test(candidato)) {
      puntaje = parseInt(candidato, 10);
    } else if (candidato.includes('1') || candidato.toLowerCase().includes('malo')) {
      puntaje = 1;
    } else if (candidato.includes('5') || candidato.toLowerCase().includes('excelente')) {
      puntaje = 5;
    } else if (candidato.includes('3') || candidato.toLowerCase().includes('regular')) {
      puntaje = 3;
    }

    if (puntaje !== null) {
      // Actualizar encuesta
      await this.prisma.encuestaPosventa.update({
        where: { id: encuesta.id },
        data: {
          puntaje,
          respondida_en: new Date(),
          estado: 'RESPONDIDA',
          comentario: texto !== String(puntaje) ? texto : null,
        },
      });

      // Leer parámetro de umbral de queja (por defecto 2)
      const paramQueja = await this.prisma.parametro.findUnique({
        where: { clave: 'encuesta_puntaje_queja' },
      });
      const umbralQueja = typeof paramQueja?.valor === 'number' ? paramQueja.valor : 2;

      if (puntaje <= umbralQueja) {
        const nombreCliente =
          (conversacion ? obtenerNombreMostrar(conversacion) : null) ||
          pedido.cliente_nombre ||
          telMask;

        // Registrar queja en queja_whatsapp
        const queja = await this.prisma.quejaWhatsapp.create({
          data: {
            origen: 'ENCUESTA',
            pedido_id: pedido.id,
            cliente: nombreCliente,
            telefono_hash: telHash,
            puntaje,
            texto: texto || `Calificación baja en encuesta posventa (${puntaje}/5)`,
            estado: 'NUEVA',
          },
        });

        // Notificar por campana a ADMIN y CAJA
        const tituloNotif = 'Queja de WhatsApp recibida';
        const detalleNotif = `El cliente de pedido ${pedido.codigo} califico con puntaje ${puntaje}/5. Requiere atencion.`;

        const notif = await this.prisma.notificacion.create({
          data: {
            tipo: 'QUEJA_WHATSAPP',
            rol_destino: null, // visible para ADMIN y CAJA
            titulo: tituloNotif,
            mensaje: detalleNotif,
            enlace: '/admin/reclamos',
          },
        });

        this.eventos?.emitirAdmin('notificaciones:nueva', {
          id: notif.id.toString(),
          titulo: tituloNotif,
        });

        this.logger.log(`Queja de WhatsApp creada id ${queja.id} para pedido ${pedido.codigo}`);
      }

      // Agradecer al cliente
      const agradecimiento =
        puntaje <= umbralQueja
          ? 'Gracias por tu respuesta. Lamentamos que tu experiencia no haya sido optima; nuestro equipo revisara tu caso para contactarte y mejorar.'
          : 'Muchas gracias por calificar nuestro servicio. Esperamos atenderte nuevamente pronto.';

      // Enviar agradecimiento si el cliente tiene teléfono
      if (pedido.cliente_telefono) {
        await this.mensajeria.enviarTexto(pedido.cliente_telefono, agradecimiento);
      }
    }
  }

  /**
   * Procesa posibles respuestas de confirmación de reprogramación tras espera agotada.
   */
  private async procesarPosibleReprogramacion(
    texto: string,
    buttonPayload: string | null,
    pedido: any,
    telMask: string,
    telefono: string,
  ) {
    if (!pedido) return;
    const candidato = (buttonPayload || texto).toLowerCase().trim();

    if (
      candidato === 'reprogramar_si' ||
      candidato === 'si' ||
      candidato === 'sí' ||
      candidato.includes('reprogramar')
    ) {
      // Registrar que el cliente desea reprogramar y notificar a Caja
      const tituloNotif = 'Cliente solicita reprogramar entrega';
      const mensajeNotif = `El cliente de ${pedido.codigo} solicita reprogramacion con recargo tras espera agotada. Coordinar por telefono.`;

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'REPROGRAMACION_DELIVERY',
          rol_destino: 'CAJA',
          titulo: tituloNotif,
          mensaje: mensajeNotif,
          enlace: '/admin/caja',
        },
      });

      this.eventos?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo: tituloNotif,
      });

      await this.mensajeria.enviarTexto(
        telefono,
        'Recibimos tu solicitud de reprogramacion. El equipo de Caja se comunicara contigo a la brevedad para coordinar la entrega.',
      );
    } else if (candidato === 'reprogramar_no' || candidato === 'no gracias' || candidato === 'no') {
      await this.mensajeria.enviarTexto(
        telefono,
        'Entendido. Tu pedido no sera reprogramado. Si deseas alguna asistencia comunicate con nuestro local. Gracias.',
      );
    }
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
