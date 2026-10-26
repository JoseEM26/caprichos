import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { LocalService } from '../../local/local.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import {
  enmascararTelefono,
  normalizarTelefono,
} from '../utilidades/enmascarar.util';
import {
  esRemitenteSinTelefono,
  obtenerNombreMostrar,
} from '../../mensajes/utilidades/nombre-contacto.util';
import { EntradaRawInput, normalizarEntrada } from './normalizador-entrada.util';
import { transicionarEstado } from './maquina-estados';
import {
  ContextoConversacion,
  DatosHorarioLocal,
  FlujoConversacion,
} from './tipos-conversacion';

export interface EntradaProcesarMensaje extends EntradaRawInput {
  waMessageId?: string;
  telefono?: string;
  telMask?: string;
}

@Injectable()
export class EjecutorConversacionService {
  private readonly logger = new Logger(EjecutorConversacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localService: LocalService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /**
   * Consulta si el chatbot está habilitado mediante el parámetro operativo `chatbot_activo = 'si'`.
   */
  async estaChatbotActivo(): Promise<boolean> {
    try {
      const parametro = await this.prisma.parametro.findUnique({
        where: { clave: 'chatbot_activo' },
      });
      if (!parametro || parametro.valor === null || parametro.valor === undefined) {
        return false;
      }
      const val = parametro.valor;
      return val === true || String(val).toLowerCase().trim() === 'si';
    } catch (err: any) {
      this.logger.error(`Error consultando parámetro chatbot_activo: ${err.message}`);
      return false;
    }
  }

  /**
   * Comprueba límite de frecuencia: máximo 5 respuestas del bot por conversación por minuto usando Redis.
   */
  private async verificarRateLimit(conversacionId: string | bigint): Promise<boolean> {
    try {
      const redis = this.redisService.obtenerCliente();
      const clave = `chatbot:rate-limit:${conversacionId.toString()}`;
      const respuestas = await redis.incr(clave);
      if (respuestas === 1) {
        await redis.expire(clave, 60);
      }
      return respuestas <= 5;
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para rate limit del chatbot: ${err.message}`);
      // Comportamiento defensivo: permite la respuesta si Redis está inactivo
      return true;
    }
  }

  /**
   * Verifica idempotencia para evitar generar respuestas duplicadas ante reentregas de Meta.
   */
  private async verificarIdempotencia(waMessageId?: string): Promise<boolean> {
    if (!waMessageId) return true;
    try {
      const redis = this.redisService.obtenerCliente();
      const clave = `chatbot:respondido:${waMessageId}`;
      const yaExiste = await redis.get(clave);
      if (yaExiste) {
        return false;
      }
      // Marcar durante 24 horas (86400 segundos)
      await redis.set(clave, '1', 'EX', 86400);
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Procesa un mensaje entrante coordinando el motor puro de conversación,
   * aplicando validaciones de estado, rate limit, idempotencia y despachando las acciones al puerto.
   */
  async procesarMensajeEntrante(
    conversacionId: bigint | string,
    entradaRaw: EntradaProcesarMensaje,
  ): Promise<boolean> {
    const idBigInt = typeof conversacionId === 'bigint' ? conversacionId : BigInt(conversacionId);

    // 1. Cargar la conversación
    const conversacion = await this.prisma.conversacion.findUnique({
      where: { id: idBigInt },
    });

    if (!conversacion) {
      this.logger.warn(`Conversación ${conversacionId} no encontrada para el bot.`);
      return false;
    }

    // 2. Solo responde si el dueño es estrictamente el BOT y no ha sido tomado por una persona
    if (conversacion.duenio !== 'BOT' || conversacion.tomado_por !== null) {
      this.logger.log(`Conversación ${conversacionId} en manos de PERSONA (${conversacion.duenio}). El bot calla.`);
      return false;
    }

    // 3. Verificar interruptor general chatbot_activo === 'si'
    const activo = await this.estaChatbotActivo();
    if (!activo) {
      this.logger.log(`Chatbot apagado por configuración (chatbot_activo != 'si').`);
      return false;
    }

    // 4. Idempotencia por wa_message_id
    if (entradaRaw.waMessageId) {
      const esNuevo = await this.verificarIdempotencia(entradaRaw.waMessageId);
      if (!esNuevo) {
        this.logger.log(`Mensaje ${entradaRaw.waMessageId} ya fue respondido por el bot. Omitiendo duplicado.`);
        return false;
      }

      const flujoExistente = (conversacion.flujo as any) || {};
      if (flujoExistente.ultimo_wa_message_id === entradaRaw.waMessageId) {
        this.logger.log(`Mensaje ${entradaRaw.waMessageId} ya registrado en flujo de conversación. Omitiendo.`);
        return false;
      }
    }

    // 5. Rate limit: máximo 5 respuestas por minuto
    const permitidoRateLimit = await this.verificarRateLimit(conversacion.id);
    if (!permitidoRateLimit) {
      this.logger.warn(
        `Límite de 5 respuestas por minuto excedido para la conversación ${conversacion.id}. Silenciando respuesta temporalmente.`,
      );
      return false;
    }

    // 6. Preparar datos del contexto
    const nombreMostrar = obtenerNombreMostrar(conversacion);
    const cartaUrlPublica = this.configService.get<string>('CARTA_URL_PUBLICA', '').trim();

    // Consultar horarios y datos del local
    let datosLocal: DatosHorarioLocal | undefined;
    try {
      const estadoCarta = await this.localService.obtenerEstadoCarta(new Date());
      const datosLocalRaw: any = await this.localService.obtenerDatosLocal();
      datosLocal = {
        abierta: estadoCarta.abierta,
        abre: estadoCarta.abre,
        cierra: estadoCarta.cierra,
        textoEstado: estadoCarta.texto,
        pausaAltaDemanda: estadoCarta.pausaAltaDemanda,
        motivoPausa: estadoCarta.motivo === 'PAUSA' ? estadoCarta.texto : undefined,
        direccion: datosLocalRaw?.direccion || 'Av. Principal 123',
        enlaceMapa:
          datosLocalRaw?.enlace_mapa ||
          datosLocalRaw?.mapa_url ||
          'https://www.google.com/maps?q=-12.0196436,-76.963255',
      };
    } catch (err: any) {
      this.logger.warn(`No se pudieron obtener datos del local: ${err.message}`);
      datosLocal = {
        abierta: true,
        abre: '17:00',
        cierra: '23:00',
        direccion: 'Av. Principal 123',
        enlaceMapa: 'https://www.google.com/maps?q=-12.0196436,-76.963255',
      };
    }

    const contexto: ContextoConversacion = {
      nombreCliente: nombreMostrar !== 'Contacto sin nombre' ? nombreMostrar : null,
      cartaUrlPublica,
      datosLocal,
    };

    // 7. Normalizar entrada y ejecutar la máquina de estados pura
    const entradaNorm = normalizarEntrada(entradaRaw);
    const flujoPrevio = (conversacion.flujo as any) as FlujoConversacion | null;
    const resultado = transicionarEstado(flujoPrevio, entradaNorm, contexto);

    // 8. Determinar destino (número E.164 normalizado o BSUID de Meta)
    const sinTelefono = esRemitenteSinTelefono(conversacion);
    const destinoEnvio = sinTelefono
      ? conversacion.telefono?.trim() || null
      : normalizarTelefono(conversacion.telefono) || null;
    const telMask =
      entradaRaw.telMask ||
      (conversacion.telefono ? enmascararTelefono(conversacion.telefono) : 'Usuario de WhatsApp');

    // 9. Ejecutar las acciones devueltas por el motor
    for (const accion of resultado.acciones) {
      if (accion.tipo === 'enviarTexto') {
        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarTexto(destinoEnvio, accion.texto, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
          metaId = res.waMessageId || null;
        }

        // Registrar en mensaje_chat con autor BOT
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'TEXTO',
            contenido: { texto: accion.texto },
            meta_id: metaId,
          },
        });
      } else if (accion.tipo === 'enviarBotones') {
        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarBotones(
            destinoEnvio,
            accion.texto,
            accion.botones.slice(0, 3),
            {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            },
          );
          metaId = res.waMessageId || null;
        }

        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'BOTON',
            contenido: {
              texto: accion.texto,
              botones: accion.botones.slice(0, 3),
            } as any,
            meta_id: metaId,
          },
        });
      } else if (accion.tipo === 'enviarLista') {
        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarLista(
            destinoEnvio,
            accion.texto,
            accion.botonTexto,
            accion.filas.slice(0, 10),
            {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
              tituloSeccion: accion.tituloSeccion,
            },
          );
          metaId = res.waMessageId || null;
        }

        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'LISTA',
            contenido: {
              texto: accion.texto,
              botonTexto: accion.botonTexto,
              filas: accion.filas.slice(0, 10),
            } as any,
            meta_id: metaId,
          },
        });
      } else if (accion.tipo === 'pasarAPersona') {
        // Reglas de MensajesService: dueño PERSONA, estado de atención ABIERTA, notificación campana
        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            duenio: 'PERSONA',
            urgente: false,
            estado:
              !conversacion.estado || conversacion.estado === 'ATENDIDA'
                ? 'ABIERTA'
                : conversacion.estado,
            tomado_por: null,
            tomado_en: null,
            ultima_actividad: new Date(),
          },
        });

        const tituloNotif = 'Solicitud de atención humana en WhatsApp';
        const mensajeNotif = `El cliente (${telMask}) solicitó hablar con una persona.`;

        const notif = await this.prisma.notificacion.create({
          data: {
            tipo: 'ATENCION_WHATSAPP',
            rol_destino: null, // Visible para ADMIN y CAJA
            titulo: tituloNotif,
            mensaje: mensajeNotif,
            enlace: '/admin/mensajes',
          },
        });

        this.eventos?.emitirAdmin('notificaciones:nueva', {
          id: notif.id.toString(),
          titulo: tituloNotif,
        });

        this.logger.log(`Conversación ${conversacion.id} derivada a PERSONA. Notificación campana id ${notif.id}.`);
      }
    }

    // 10. Persistir el nuevo flujo en la conversación
    const flujoPersistir: FlujoConversacion = {
      ...resultado.nuevoFlujo,
      ultimo_wa_message_id: entradaRaw.waMessageId || undefined,
    };

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: {
        flujo: flujoPersistir,
        ultima_actividad: new Date(),
      },
    });

    // 11. Notificar por WebSocket a la consola de Mensajes
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });

    return true;
  }
}
