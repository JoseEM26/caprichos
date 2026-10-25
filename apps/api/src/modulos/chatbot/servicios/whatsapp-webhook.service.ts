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
  private async procesarMensajeEntrante(msg: any) {
    const waMessageId = msg.id;
    const rawFrom = String(msg.from || '');
    const telefonoNorm = normalizarTelefono(rawFrom);
    const telHash = hashTelefono(telefonoNorm);
    const telMask = enmascararTelefono(telefonoNorm);
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

      // Confirmar al cliente
      await this.mensajeria.enviarTexto(
        telefonoNorm,
        'Hemos registrado tu solicitud de baja. No te enviaremos mas mensajes promocionales ni informativos, salvo comunicaciones estrictamente operativas de pedidos que tengas en curso. Si deseas volver a recibir avisos escribe ALTA.',
      );
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
      await this.mensajeria.enviarTexto(
        telefonoNorm,
        'Has reactivado los avisos de Caprichos. Te mantendremos informado sobre el estado de tus pedidos.',
      );
    }

    // 2. Buscar último pedido activo o reciente del cliente para asociarlo
    const pedidoReciente = await this.prisma.pedido.findFirst({
      where: {
        OR: [
          { cliente_telefono: { contains: telefonoNorm.slice(-8) } },
          { cliente_telefono: telefonoNorm },
        ],
      },
      orderBy: { creado_en: 'desc' },
      select: { id: true, codigo: true, cliente_nombre: true, estado: true, modalidad: true },
    });

    // 3. Procesamiento de encuesta posventa
    await this.procesarPosibleEncuesta(telHash, telMask, texto, buttonPayload, pedidoReciente);

    // 4. Procesamiento de respuesta a reprogramación
    await this.procesarPosibleReprogramacion(texto, buttonPayload, pedidoReciente, telMask, telefonoNorm);

    // 5. Procesamiento de imagen de voucher
    if (imagenBuffer && pedidoReciente) {
      await this.guardarVoucherPrivado(imagenBuffer, imagenMime, pedidoReciente, telMask);
    }

    // 6. Asociar a conversación existente en módulo mensajes sin romper su flujo
    let conversacion = await this.prisma.conversacion.findUnique({
      where: { telefono: telefonoNorm },
    });

    if (!conversacion) {
      conversacion = await this.prisma.conversacion.create({
        data: {
          telefono: telefonoNorm,
          duenio: 'BOT',
          estado: 'ABIERTA',
          ultima_actividad: new Date(),
        },
      });
    } else {
      await this.prisma.conversacion.update({
        where: { id: conversacion.id },
        data: { ultima_actividad: new Date() },
      });
    }

    // Registrar mensaje en mensaje_chat del módulo de mensajes
    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacion.id,
        direccion: 'ENTRA',
        autor: 'CLIENTE',
        tipo: tipoRegistro === 'IMAGEN' ? 'IMAGEN' : 'TEXTO',
        contenido: { texto },
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
  ) {
    try {
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

      // Notificación de campana a Caja
      const tituloNotif = 'Comprobante de pago recibido';
      const mensajeNotif = `El cliente (${telMask}) envio un comprobante para el pedido ${pedido.codigo}.`;

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'COMPROBANTE_RECIBIDO',
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

      this.logger.log(
        `Voucher privado guardado para pedido ${pedido.codigo} (archivo id: ${archivoSubido.id})`,
      );
    } catch (err: any) {
      this.logger.error(`Error guardando comprobante privado: ${err.message}`);
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
        // Registrar queja en queja_whatsapp
        const queja = await this.prisma.quejaWhatsapp.create({
          data: {
            origen: 'ENCUESTA',
            pedido_id: pedido.id,
            cliente: pedido.cliente_nombre || telMask,
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

      // Enviar agradecimiento (ventana está abierta porque el cliente acaba de escribir)
      await this.mensajeria.enviarTexto(pedido.cliente_telefono || telMask, agradecimiento);
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
            const nuevo = await this.procesarMensajeEntrante(msg);
            if (nuevo) mensajesProcesados++;
          }
        }
      }
    }

    return { procesados: mensajesProcesados, estados: estadosProcesados };
  }
}
