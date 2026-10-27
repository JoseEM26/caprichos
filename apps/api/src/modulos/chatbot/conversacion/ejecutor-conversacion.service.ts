import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { LocalService } from '../../local/local.service';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { OfertasService } from '../../ofertas/ofertas.service';
import { SeguimientoService } from '../../pedidos/seguimiento.service';
import { PedidosService } from '../../pedidos/pedidos.service';
import { ZonasService } from '../../zonas/zonas.service';
import { ReservasService } from '../../reservas/reservas.service';
import { ChatbotIaService } from '../ia/chatbot-ia.service';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';
import { BOTON_VOLVER_MENU, TEXTOS_BOT } from './textos-bot';
import { TEXTOS_RESERVA } from './textos-reserva';
import { TEXTOS_IA, BOTONES_IA_ESTANDAR, BOTONES_IA_CON_PEDIDO } from './textos-ia';
import { obtenerFechaLimaActual, resolverFechaEntradaReserva } from './flujos/reserva/flujo-reserva';
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
import { obtenerFechaHoraLima } from '../../local/local.util';

export interface EntradaProcesarMensaje extends EntradaRawInput {
  waMessageId?: string;
  telefono?: string;
  telMask?: string;
  id?: string;
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
    @Optional() private readonly catalogoService?: CatalogoService,
    @Optional() private readonly ofertasService?: OfertasService,
    @Optional() private readonly seguimientoService?: SeguimientoService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly pedidosService?: PedidosService,
    @Optional() private readonly zonasService?: ZonasService,
    @Optional()
    @Inject(forwardRef(() => ReservasService))
    private readonly reservasService?: ReservasService,
    @Optional() private readonly chatbotIaService?: ChatbotIaService,
    @Optional() private readonly chatbotConfiguracionService?: ChatbotConfiguracionService,
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
      return true;
    }
  }

  /**
   * Límite estricto de seguridad: máximo 5 consultas de estado de pedido por minuto (requisito d).
   */
  private async verificarRateLimitPedido(conversacionId: string | bigint): Promise<boolean> {
    try {
      const redis = this.redisService.obtenerCliente();
      const clave = `chatbot:rate-limit-pedido:${conversacionId.toString()}`;
      const consultas = await redis.incr(clave);
      if (consultas === 1) {
        await redis.expire(clave, 60);
      }
      return consultas <= 5;
    } catch (err: any) {
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

    // 2. Solo responde si el dueño es estrictamente el BOT y no ha sido tomado por una persona.
    // Regla de contrato (Sección 3): Mientras hay un pago pendiente de validar (VALIDAR_PAGO), el bot
    // sigue atendiendo menú, carta, horario, estado del pedido y nuevos pedidos; solo no decide el pago.
    const esValidarPago = conversacion.estado === 'VALIDAR_PAGO';
    if ((conversacion.duenio !== 'BOT' || conversacion.tomado_por !== null) && !esValidarPago) {
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

    // 4.b Límite de mensajes por teléfono y protección anti-spam en Redis (Ola 4, Agente I)
    if (this.chatbotConfiguracionService) {
      const identificadorAntiSpam = entradaRaw.telefono || conversacion.telefono;
      const antiSpamCheck = await this.chatbotConfiguracionService.verificarAntiSpam(identificadorAntiSpam);
      if (!antiSpamCheck.permitido) {
        if (antiSpamCheck.enviarAvisoSpam && antiSpamCheck.mensajeAviso) {
          this.logger.warn(
            `Límite anti-spam alcanzado para ${entradaRaw.telMask || 'cliente'}. Enviando respuesta amable una sola vez.`,
          );
          await this.mensajeria.enviarTexto(
            conversacion.telefono,
            antiSpamCheck.mensajeAviso,
            {
              replyToWaMessageId: entradaRaw.waMessageId,
              conversacionId: conversacion.id,
            },
          );
        } else {
          this.logger.warn(
            `Límite anti-spam activo para ${entradaRaw.telMask || 'cliente'}. Silenciando respuesta.`,
          );
        }
        return false;
      }
    }

    // 5. Rate limit general: máximo 5 respuestas por minuto
    const permitidoRateLimit = await this.verificarRateLimit(conversacion.id);
    if (!permitidoRateLimit) {
      this.logger.warn(
        `Límite de 5 respuestas por minuto excedido para la conversación ${conversacion.id}. Silenciando respuesta temporalmente.`,
      );
      return false;
    }

    // 6. Preparar datos del contexto consumiendo servicios y la Base de Datos
    const nombreMostrar = obtenerNombreMostrar(conversacion);
    const cartaUrlPublica = this.configService.get<string>('CARTA_URL_PUBLICA', '').trim();
    const telefonoCliente = normalizarTelefono(conversacion.telefono);

    let errorServicio = false;
    let datosLocal: DatosHorarioLocal | undefined;
    let datosLocalPublicos: any = null;
    let categoriasCarta: any[] = [];
    let ofertas: any[] = [];
    let pedidoActivo: any = null;
    let limiteConsultasExcedido = false;

    try {
      // a) Consulta de datos del local y estado de apertura
      const estadoCarta = await this.localService.obtenerEstadoCarta(new Date());
      const datosPublicos =
        typeof (this.localService as any).obtenerDatosPublicosLocal === 'function'
          ? await (this.localService as any).obtenerDatosPublicosLocal()
          : (await (this.localService as any).obtenerDatosLocal?.()) || {};

      const carta = this.catalogoService ? await this.catalogoService.obtenerCarta() : [];

      datosLocalPublicos = datosPublicos;
      categoriasCarta = carta || [];

      if (this.ofertasService) {
        ofertas = await this.ofertasService.listarOfertas(undefined, true, 'WHATSAPP');
      }

      const altaDemandaExtra = (estadoCarta as any)?.altaDemandaExtra || 0;
      const mapaUrl =
        datosPublicos?.lat && datosPublicos?.lng
          ? `https://www.google.com/maps?q=${datosPublicos.lat},${datosPublicos.lng}`
          : 'https://www.google.com/maps?q=-12.0196436,-76.963255';

      datosLocal = {
        abierta: estadoCarta.abierta,
        abre: estadoCarta.abre,
        cierra: estadoCarta.cierra,
        textoEstado: estadoCarta.texto,
        pausaAltaDemanda: estadoCarta.pausaAltaDemanda,
        motivoPausa: estadoCarta.motivo === 'PAUSA' ? estadoCarta.texto : undefined,
        direccion: datosPublicos?.direccion || 'Campoy, San Juan de Lurigancho, Lima',
        enlaceMapa: mapaUrl,
        telefono: datosPublicos?.telefono || datosPublicos?.whatsapp || '9XX XXX XXX',
        altaDemandaMinutosExtra: altaDemandaExtra,
      };

      // b) Búsqueda y validación estricta de "Mi pedido" (requisito d)
      const matchCodigo =
        entradaRaw.texto?.match(/CP-\d{4}/i) ||
        entradaRaw.textoOriginal?.match(/CP-\d{4}/i);
      const codigoBuscado = matchCodigo ? matchCodigo[0].toUpperCase() : null;

      const idInteractivo = entradaRaw.buttonPayload || entradaRaw.listRowId;
      const codigoId = idInteractivo?.startsWith('ord_') ? idInteractivo.replace('ord_', '') : null;
      const codigoFinal = codigoBuscado || codigoId;

      const flujoExistente = (conversacion.flujo as any) || {};

      if (codigoFinal) {
        const rateLimitPedidoOk = await this.verificarRateLimitPedido(conversacion.id);
        if (!rateLimitPedidoOk) {
          limiteConsultasExcedido = true;
        } else {
          const pedidoEncontrado = await this.prisma.pedido.findUnique({
            where: { codigo: codigoFinal },
          });

          // Seguridad estricta: nunca exponer datos de otro cliente.
          // Si el pedido tiene teléfono registrado, debe coincidir con el teléfono de la conversación.
          if (pedidoEncontrado) {
            const telPedido = normalizarTelefono(pedidoEncontrado.cliente_telefono || '');
            if (!telPedido || !telefonoCliente || telPedido === telefonoCliente) {
              pedidoActivo = pedidoEncontrado;
            } else {
              // Pertenece a otro cliente: rechazar
              pedidoActivo = null;
            }
          } else {
            pedidoActivo = null;
          }
        }
      } else if (flujoExistente.codigoPedido) {
        const rateLimitPedidoOk = await this.verificarRateLimitPedido(conversacion.id);
        if (!rateLimitPedidoOk) {
          limiteConsultasExcedido = true;
        } else {
          const pedidoEncontrado = await this.prisma.pedido.findUnique({
            where: { codigo: flujoExistente.codigoPedido },
          });
          if (pedidoEncontrado) {
            const telPedido = normalizarTelefono(pedidoEncontrado.cliente_telefono || '');
            if (!telPedido || !telefonoCliente || telPedido === telefonoCliente) {
              pedidoActivo = pedidoEncontrado;
            }
          }
        }
      } else if (telefonoCliente) {
        // Buscar el último pedido activo del cliente en las últimas 24 horas
        const pedidoReciente = await this.prisma.pedido.findFirst({
          where: {
            cliente_telefono: { contains: telefonoCliente.slice(-8) },
            creado_en: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
          },
          orderBy: { creado_en: 'desc' },
        });
        if (pedidoReciente) {
          pedidoActivo = pedidoReciente;
        }
      }
    } catch (err: any) {
      this.logger.error(`Error consultando base de datos o servicios del chatbot: ${err.message}`, err.stack);
      errorServicio = true;
    }

    let minutosInactividad = 0;
    let inactividadExpirada = false;
    if (conversacion.ultima_actividad) {
      const ms = Date.now() - new Date(conversacion.ultima_actividad).getTime();
      minutosInactividad = Math.floor(ms / (60 * 1000));
      if (minutosInactividad >= 30) {
        inactividadExpirada = true;
      }
    }

    let pedidosHoyTelefono = 0;
    if (telefonoCliente) {
      try {
        const inicioHoy = new Date();
        inicioHoy.setHours(0, 0, 0, 0);
        pedidosHoyTelefono = await this.prisma.pedido.count({
          where: {
            cliente_telefono: { contains: telefonoCliente.slice(-8) },
            creado_en: { gte: inicioHoy },
          },
        });
      } catch (err: any) {
        this.logger.warn(`Error consultando pedidos de hoy: ${err.message}`);
      }
    }

    let resultadoEnvio: any = null;
    if (
      entradaRaw.ubicacion &&
      entradaRaw.ubicacion.latitud != null &&
      entradaRaw.ubicacion.longitud != null &&
      this.zonasService
    ) {
      try {
        resultadoEnvio = await this.zonasService.consultarEnvio(
          entradaRaw.ubicacion.latitud,
          entradaRaw.ubicacion.longitud,
        );
      } catch (err: any) {
        this.logger.warn(`Error consultando cobertura/envío por ubicación: ${err.message}`);
      }
    }

    // 6.b Consultar franjas de reserva si el flujo está en reserva o es intención de reserva
    let franjasDisponiblesReserva: string[] | undefined;
    let solicitudesPendientesTelefono: number | undefined;
    let solicitudesCambioPendientesTelefono: number | undefined;
    let reservasActivasCliente: Array<{ id: string; fecha: string; hora: string; personas: number; mesas: string[] }> | undefined;

    try {
      const flujoPrevioParaReserva = (conversacion.flujo as any) as FlujoConversacion | null;
      if (
        this.reservasService &&
        (flujoPrevioParaReserva?.estado === 'RESERVA' ||
          String(flujoPrevioParaReserva?.estado).startsWith('RESERVA_') ||
          (entradaRaw as any).id === 'reservar' ||
          entradaRaw.buttonPayload === 'reservar' ||
          entradaRaw.texto?.includes('reserva'))
      ) {
        // En el paso FECHA la fecha llega en este mismo mensaje: consultar las franjas de esa fecha
        const estadoReservaPrevio = String(
          (flujoPrevioParaReserva?.reserva as any)?.estadoInterno || flujoPrevioParaReserva?.estado || '',
        );
        const fechaElegida =
          estadoReservaPrevio === 'RESERVA_FECHA' || estadoReservaPrevio === 'RESERVA_FECHA_OTRA'
            ? resolverFechaEntradaReserva(normalizarEntrada(entradaRaw))?.fechaIso
            : undefined;
        const fechaParaFranjas =
          fechaElegida ||
          (flujoPrevioParaReserva?.reserva as any)?.datos?.fechaIso ||
          obtenerFechaLimaActual(0).fechaIso;
        const personasParaFranjas = (flujoPrevioParaReserva?.reserva as any)?.datos?.personas || 2;
        franjasDisponiblesReserva = await this.reservasService.obtenerFranjasDisponibles(
          fechaParaFranjas,
          personasParaFranjas,
        );
      }

      // Conteo de solicitudes pendientes para el teléfono
      const rawTel = (conversacion.telefono || '').trim();
      if (rawTel) {
        solicitudesPendientesTelefono = await this.prisma.solicitudReserva.count({
          where: {
            estado: 'PENDIENTE',
            OR: [
              { conversacion_id: conversacion.id },
              { telefono: rawTel },
            ],
          },
        });

        // Conteo de solicitudes de cambio pendientes para pedidos del teléfono/conversación
        solicitudesCambioPendientesTelefono = await this.prisma.solicitudCambio.count({
          where: {
            estado: 'PENDIENTE',
            OR: [
              { conversacion_id: conversacion.id },
              { pedido: { cliente_telefono: rawTel } },
            ],
          },
        });

        // Reservas activas del cliente (para cancelar o cambiar)
        const ahoraLima = new Date();
        const reservasDb = await this.prisma.reserva.findMany({
          where: {
            estado: 'ACTIVA',
            telefono: rawTel,
            hora: { gte: ahoraLima },
          },
          include: { mesas: { include: { mesa: true } } },
          orderBy: { hora: 'asc' },
        });

        reservasActivasCliente = reservasDb.map((r) => {
          const { fechaIso: f, horaMinutos: h } = obtenerFechaHoraLima(r.hora);
          return {
            id: r.id.toString(),
            fecha: f,
            hora: h,
            personas: r.personas,
            mesas: r.mesas.map((rm) => rm.mesa?.nombre || rm.mesa?.numero?.toString() || '').filter(Boolean),
          };
        });
      }
    } catch (err: any) {
      this.logger.warn(`Error al consultar reservas para contexto: ${err.message}`);
    }

    let chatbotIaActivo = false;
    if (this.chatbotIaService) {
      try {
        chatbotIaActivo = await this.chatbotIaService.estaDisponible();
      } catch (err: any) {
        this.logger.warn(`Error comprobando disponibilidad de IA: ${err.message}`);
      }
    }

    let funcionesActivas: any = undefined;
    let textosPersonalizados: Record<string, string> | undefined = undefined;
    if (this.chatbotConfiguracionService) {
      try {
        funcionesActivas = await this.chatbotConfiguracionService.obtenerFuncionesActivas();
        textosPersonalizados = await this.chatbotConfiguracionService.obtenerTextosBot();
      } catch (err: any) {
        this.logger.warn(`Error obteniendo configuración del bot: ${err.message}`);
      }
    }

    const contexto: ContextoConversacion = {
      conversacionId: conversacion.id.toString(),
      nombreCliente: nombreMostrar,
      telefonoCliente,
      cartaUrlPublica,
      datosLocal,
      datosLocalPublicos,
      categoriasCarta,
      ofertas,
      pedidoActivo,
      errorServicio,
      limiteConsultasExcedido,
      pedidosHoyTelefono,
      minutosInactividad,
      inactividadExpirada,
      resultadoEnvio,
      franjasDisponiblesReserva,
      solicitudesPendientesTelefono,
      solicitudesCambioPendientesTelefono,
      reservasActivasCliente,
      chatbotIaActivo,
      funcionesActivas,
      textosPersonalizados,
    };

    // 7. Determinar destino (número E.164 normalizado o BSUID de Meta)
    const sinTelefono = esRemitenteSinTelefono(conversacion);
    const destinoEnvio = sinTelefono
      ? conversacion.telefono?.trim() || null
      : normalizarTelefono(conversacion.telefono) || null;
    const telMask =
      entradaRaw.telMask ||
      (conversacion.telefono ? enmascararTelefono(conversacion.telefono) : 'Usuario de WhatsApp');

    // 7.b Manejo de espera del cliente cuando la conversación está en VALIDAR_PAGO
    // Regla de contrato (Sección 3): Mientras hay un pago pendiente de validar el bot sigue atendiendo
    // menú, carta, horario, estado del pedido y nuevos pedidos; solo no decide el pago.
    // Texto libre fuera de eso: responde una sola vez 'Ya avisé a una persona, te responde en breve'.
    if (esValidarPago) {
      const textoNorm = (entradaRaw.texto || entradaRaw.textoOriginal || '').trim().toLowerCase();
      const payload = String(
        entradaRaw.buttonPayload || entradaRaw.listReplyId || entradaRaw.listRowId || '',
      ).trim();

      const esCarta =
        payload === 'btn_esp_carta' ||
        payload === 'carta' ||
        textoNorm === 'carta' ||
        textoNorm.includes('ver la carta') ||
        textoNorm.includes('ver carta') ||
        textoNorm === 'la carta';

      const esMenu =
        payload === 'btn_menu' ||
        payload === 'volver_menu' ||
        payload === 'inicio' ||
        textoNorm === 'menu' ||
        textoNorm === 'inicio' ||
        textoNorm === '0';

      const esHorario =
        payload === 'btn_horario' ||
        payload === 'btn_ubicacion' ||
        textoNorm.includes('horario') ||
        textoNorm.includes('ubicacion') ||
        textoNorm.includes('donde estan') ||
        textoNorm.includes('a que hora');

      const esEstadoPedido =
        Boolean(textoNorm.match(/cp-\d{4}/i)) ||
        payload.startsWith('ord_') ||
        textoNorm.includes('mi pedido') ||
        textoNorm.includes('estado');

      const esNuevoPedido =
        payload === 'pedir' ||
        payload === 'delivery' ||
        payload === 'recojo' ||
        textoNorm === 'pedir' ||
        textoNorm.includes('nuevo pedido');

      const esSeguirEsperando =
        payload === 'btn_esp_esperar' ||
        textoNorm === 'seguir esperando' ||
        textoNorm.includes('espero');

      const esHablarPersona =
        payload === 'btn_esp_persona' ||
        textoNorm === 'asesor' ||
        textoNorm.includes('persona') ||
        textoNorm.includes('hablar con persona');

      if (esCarta) {
        const urlCarta = contexto.cartaUrlPublica || 'https://caprichos.pe/carta';
        const textoCarta = `Puedes revisar nuestra carta completa aquí:\n👉 ${urlCarta}\n\nSeguimos revisando tu pago en Caja.`;
        const botones = [
          { id: 'btn_esp_esperar', titulo: 'Seguir esperando' },
          { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
        ];
        if (destinoEnvio) {
          await this.mensajeria.enviarBotones(destinoEnvio, textoCarta, botones, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
        }
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'BOTON',
            contenido: { texto: textoCarta, botones } as any,
          },
        });
        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            estado: 'VALIDAR_PAGO',
            duenio: 'PERSONA',
            ultima_actividad: new Date(),
          },
        });
        return true;
      }

      if (esMenu) {
        const textoMenu = `Claro. Mientras revisamos tu pago en Caja, ¿en qué te puedo ayudar?`;
        const botones = [
          { id: 'btn_esp_carta', titulo: 'Ver la carta' },
          { id: 'mipedido', titulo: 'Mi pedido' },
          { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
        ];
        if (destinoEnvio) {
          await this.mensajeria.enviarBotones(destinoEnvio, textoMenu, botones, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
        }
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'BOTON',
            contenido: { texto: textoMenu, botones } as any,
          },
        });
        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            estado: 'VALIDAR_PAGO',
            duenio: 'PERSONA',
            ultima_actividad: new Date(),
          },
        });
        return true;
      }

      if (esHorario) {
        const datos = contexto.datosLocal;
        const textoHorario = `🕒 *Horario de atención:* ${datos?.abre || '12:00'} a ${datos?.cierra || '23:00'}.\n📍 *Dirección:* ${datos?.direccion || 'Campoy, SJL'}.\n\nSeguimos validando tu pago en Caja.`;
        const botones = [
          { id: 'btn_esp_carta', titulo: 'Ver la carta' },
          { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
        ];
        if (destinoEnvio) {
          await this.mensajeria.enviarBotones(destinoEnvio, textoHorario, botones, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
        }
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'BOTON',
            contenido: { texto: textoHorario, botones } as any,
          },
        });
        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            estado: 'VALIDAR_PAGO',
            duenio: 'PERSONA',
            ultima_actividad: new Date(),
          },
        });
        return true;
      }

      if (esEstadoPedido && contexto.pedidoActivo) {
        const p = contexto.pedidoActivo;
        const textoPedido = `Tu pedido *${p.codigo}* está en estado: *${p.estado}* (Pago: *${p.pago_estado}*).\n\nSeguimos revisando tu comprobante en Caja.`;
        if (destinoEnvio) {
          await this.mensajeria.enviarTexto(destinoEnvio, textoPedido, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
        }
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: 'TEXTO',
            contenido: { texto: textoPedido },
          },
        });
        return true;
      }

      const esConsultaPermitida =
        esCarta || esMenu || esHorario || esEstadoPedido || esNuevoPedido;

      if (!esConsultaPermitida) {
        const flujo = (conversacion.flujo as any) || {};
        const pago = flujo.pago || {};

        if (esSeguirEsperando) {
          const respuesta =
            'Seguimos revisando tu pago, ya avisamos de nuevo a Caja. Te avisaremos apenas esté validado.';
          if (destinoEnvio) {
            await this.mensajeria.enviarTexto(destinoEnvio, respuesta, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          }
          await this.prisma.mensajeChat.create({
            data: {
              conversacion_id: conversacion.id,
              direccion: 'SALE',
              autor: 'BOT',
              tipo: 'TEXTO',
              contenido: { texto: respuesta },
            },
          });
          return true;
        }

        if (esHablarPersona) {
          const respuesta = 'Ya avisé a una persona, te responde en breve.';
          if (destinoEnvio) {
            await this.mensajeria.enviarTexto(destinoEnvio, respuesta, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          }
          await this.prisma.mensajeChat.create({
            data: {
              conversacion_id: conversacion.id,
              direccion: 'SALE',
              autor: 'BOT',
              tipo: 'TEXTO',
              contenido: { texto: respuesta },
            },
          });
          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: 'CAJA',
              titulo: `Cliente solicita asesor en chat con pago pendiente (${nombreMostrar})`,
              mensaje: `El cliente solicitó asesor humano mientras su comprobante está en revisión.`,
              enlace: '/admin/mensajes',
            },
          });
          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: notif.titulo,
          });
          return true;
        }

        // Texto libre fuera de eso: el bot responde una sola vez
        if (!pago.avisoPersonaEnviado) {
          const respuesta = 'Ya avisé a una persona, te responde en breve.';
          if (destinoEnvio) {
            await this.mensajeria.enviarTexto(destinoEnvio, respuesta, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          }
          await this.prisma.mensajeChat.create({
            data: {
              conversacion_id: conversacion.id,
              direccion: 'SALE',
              autor: 'BOT',
              tipo: 'TEXTO',
              contenido: { texto: respuesta },
            },
          });

          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: 'CAJA',
              titulo: `Mensaje de cliente en chat con pago pendiente (${nombreMostrar})`,
              mensaje: `Cliente escribió: "${(entradaRaw.texto || entradaRaw.textoOriginal || '').slice(0, 100)}". Ya se le indicó que una persona le responde en breve.`,
              enlace: '/admin/mensajes',
            },
          });
          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: notif.titulo,
          });

          await this.prisma.conversacion.update({
            where: { id: conversacion.id },
            data: {
              flujo: {
                ...flujo,
                pago: {
                  ...pago,
                  avisoPersonaEnviado: true,
                },
              },
            },
          });
          return true;
        } else {
          this.logger.log(
            `Texto libre en VALIDAR_PAGO para conversación ${conversacion.id} ya tuvo aviso previo. El bot guarda silencio.`,
          );
          return true;
        }
      }

      if (payload === 'btn_esp_carta') {
        entradaRaw.buttonPayload = 'carta';
        entradaRaw.listRowId = 'carta';
        entradaRaw.texto = 'carta';
      }
    }

    // 8. Normalizar entrada y ejecutar la máquina de estados pura
    const entradaNorm = normalizarEntrada(entradaRaw);
    const flujoPrevio = (conversacion.flujo as any) as FlujoConversacion | null;
    const resultado = transicionarEstado(flujoPrevio, entradaNorm, contexto);

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
      } else if (accion.tipo === 'enviarImagen') {
        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarImagen(
            destinoEnvio,
            accion.url,
            accion.caption,
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
            tipo: 'IMAGEN',
            contenido: {
              url: accion.url,
              texto: accion.caption,
            } as any,
            meta_id: metaId,
          },
        });
      } else if (accion.tipo === 'pasarAPersona') {
        // Reglas de MensajesService: dueño PERSONA, estado de atención ABIERTA, notificación campana
        const esUrgente = accion.esUrgente ?? (accion.motivo?.includes('URGENTE') ?? false);

        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            duenio: 'PERSONA',
            urgente: esUrgente,
            estado:
              !conversacion.estado || conversacion.estado === 'ATENDIDA'
                ? 'ABIERTA'
                : conversacion.estado,
            motivo_derivacion: accion.motivo,
            tomado_por: null,
            tomado_en: null,
            ultima_actividad: new Date(),
          },
        });

        // Registro de queja en tabla queja_whatsapp si corresponde (HU-CAP-129, HU-CAP-141)
        if (accion.crearQueja) {
          try {
            const rawIdentificador = (conversacion.telefono || '').trim();
            const telHash = hashTelefono(rawIdentificador || `conv_${conversacion.id}`);
            const textoQueja = (accion.quejaTexto || accion.mensajeCliente || 'Reclamo en chat').slice(0, 500);

            // Evitar duplicados: verificar si ya existe una queja no resuelta en los últimos 30 min
            const hace30Min = new Date(Date.now() - 30 * 60 * 1000);
            const quejaExistente = await this.prisma.quejaWhatsapp.findFirst({
              where: {
                origen: 'CHAT',
                telefono_hash: telHash,
                texto: textoQueja,
                creada_en: { gte: hace30Min },
              },
            });

            if (!quejaExistente) {
              await this.prisma.quejaWhatsapp.create({
                data: {
                  origen: 'CHAT',
                  cliente: nombreMostrar,
                  telefono_hash: telHash,
                  texto: textoQueja,
                  estado: 'NUEVA',
                  pedido_id: contexto.pedidoActivo?.id ? BigInt(contexto.pedidoActivo.id) : null,
                },
              });

              const notifQueja = await this.prisma.notificacion.create({
                data: {
                  tipo: 'QUEJA_WHATSAPP',
                  rol_destino: null,
                  titulo: `Queja WhatsApp urgente (${nombreMostrar})`,
                  mensaje: `Reclamo: "${textoQueja.slice(0, 100)}"`,
                  enlace: '/admin/reclamos',
                },
              });

              this.eventos?.emitirAdmin('notificaciones:nueva', {
                id: notifQueja.id.toString(),
                titulo: notifQueja.titulo,
              });
            }
          } catch (err: any) {
            this.logger.error(`Error guardando queja_whatsapp: ${err.message}`, err.stack);
          }
        }

        const tituloNotif = esUrgente
          ? `URGENTE: Atención en WhatsApp (${nombreMostrar})`
          : `Atención requerida en WhatsApp (${nombreMostrar})`;
        const mensajeNotif = accion.mensajeCliente
          ? `Cliente escribió: "${accion.mensajeCliente.slice(0, 100)}". Motivo: ${accion.motivo}`
          : `El cliente solicitó hablar con una persona (${accion.motivo}).`;

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
      } else if (accion.tipo === 'crearPedido') {
        let codigoFinal = 'CP-0000';
        try {
          if (this.pedidosService) {
            const pedidoCreado = await this.pedidosService.crear(
              accion.dto,
              accion.claveIdempotencia,
              { canal: 'WHATSAPP' },
            );
            codigoFinal = pedidoCreado.codigo;

            // Notificación campana a Caja/Admin
            const tituloNotif = `Nuevo pedido WhatsApp: ${pedidoCreado.codigo}`;
            const notif = await this.prisma.notificacion.create({
              data: {
                tipo: 'PEDIDO_NUEVO',
                rol_destino: null,
                titulo: tituloNotif,
                mensaje: `Nuevo pedido ${pedidoCreado.codigo} por S/ ${Number(pedidoCreado.total).toFixed(2)} (${nombreMostrar}).`,
                enlace: '/admin/pedidos',
              },
            });
            this.eventos?.emitirAdmin('notificaciones:nueva', {
              id: notif.id.toString(),
              titulo: tituloNotif,
            });
          }
        } catch (err: any) {
          this.logger.error(`Error creando pedido desde chatbot: ${err.message}`, err.stack);
          await this.prisma.conversacion.update({
            where: { id: conversacion.id },
            data: {
              duenio: 'PERSONA',
              urgente: true,
              estado: 'ABIERTA',
              ultima_actividad: new Date(),
            },
          });
          const textoError = TEXTOS_BOT.errorServicio();
          if (destinoEnvio) {
            await this.mensajeria.enviarTexto(destinoEnvio, textoError, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          }
          await this.prisma.mensajeChat.create({
            data: {
              conversacion_id: conversacion.id,
              direccion: 'SALE',
              autor: 'BOT',
              tipo: 'TEXTO',
              contenido: { texto: textoError },
            },
          });
          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: null,
              titulo: `Fallo al crear pedido WhatsApp (${nombreMostrar})`,
              mensaje: `Error: ${err.message}. El asesor debe confirmar el pedido manualmente.`,
              enlace: '/admin/mensajes',
            },
          });
          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: notif.titulo,
          });
          continue;
        }

        const textoConfirmacion = TEXTOS_BOT.pedidoConfirmadoExito({
          codigo: codigoFinal,
          tiempoMin: accion.tiempoEstimadoMin,
          tiempoMax: accion.tiempoEstimadoMax,
          esPagoDigital: accion.esPagoDigital,
          datosPago: accion.datosPagoTexto,
        });

        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarBotones(
            destinoEnvio,
            textoConfirmacion,
            [BOTON_VOLVER_MENU],
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
              texto: textoConfirmacion,
              botones: [BOTON_VOLVER_MENU],
            } as any,
            meta_id: metaId,
          },
        });
      } else if (accion.tipo === 'crearSolicitudReserva') {
        try {
          const fechaHora = new Date(`${accion.fechaIso}T${accion.hora}:00-05:00`);
          const solicitud = await this.prisma.solicitudReserva.create({
            data: {
              conversacion_id: conversacion.id,
              personas: accion.personas,
              hora: fechaHora,
              estado: 'PENDIENTE',
              nombre: accion.nombre,
              telefono: accion.telefono,
              nota: accion.nota,
            },
          });

          // Notificación campana para Caja y Salón (ADMIN, CAJA, MOZO)
          const tituloNotif = `Nueva solicitud de reserva: ${accion.nombre} (${accion.personas} pers.)`;
          const mensajeNotif = `Solicitud para ${accion.personas} personas el ${accion.fechaTexto} a las ${accion.hora}. Tel: ${accion.telefono}${accion.nota ? ' · Nota: ' + accion.nota : ''}`;

          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'RESERVA_NUEVA',
              rol_destino: null,
              titulo: tituloNotif,
              mensaje: mensajeNotif,
              enlace: '/admin/reservas',
            },
          });

          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: tituloNotif,
          });

          this.eventos?.emitirAdmin('reserva:solicitud_nueva', {
            id: solicitud.id.toString(),
            nombre: accion.nombre,
            personas: accion.personas,
            hora: fechaHora.toISOString(),
          });
        } catch (err: any) {
          this.logger.error(`Error guardando solicitud de reserva: ${err.message}`, err.stack);
        }
      } else if (accion.tipo === 'cancelarReservaCliente') {
        try {
          if (this.reservasService && accion.reservaId) {
            await this.reservasService.cancelar(
              accion.reservaId,
              { motivo: accion.motivo || 'Cancelado por el cliente desde WhatsApp' },
            );

            const notif = await this.prisma.notificacion.create({
              data: {
                tipo: 'RESERVA_CANCELADA',
                rol_destino: null,
                titulo: `Reserva #${accion.reservaId} cancelada por WhatsApp`,
                mensaje: `El cliente (${nombreMostrar}) canceló su reserva desde WhatsApp. La mesa ha sido liberada.`,
                enlace: '/admin/reservas',
              },
            });

            this.eventos?.emitirAdmin('notificaciones:nueva', {
              id: notif.id.toString(),
              titulo: notif.titulo,
            });
          }
        } catch (err: any) {
          this.logger.error(`Error cancelando reserva desde chatbot: ${err.message}`, err.stack);
        }
      } else if (accion.tipo === 'cambiarReservaCliente') {
        try {
          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: null,
              titulo: `Solicitud de cambio de reserva #${accion.reservaId} (${nombreMostrar})`,
              mensaje: `Detalle del cambio: ${accion.detalle}`,
              enlace: '/admin/reservas',
            },
          });

          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: notif.titulo,
          });
        } catch (err: any) {
          this.logger.error(`Error registrando cambio de reserva desde chatbot: ${err.message}`, err.stack);
        }
      } else if (accion.tipo === 'crearSolicitudCambio') {
        try {
          await this.prisma.solicitudCambio.create({
            data: {
              pedido_id: BigInt(accion.pedidoId),
              conversacion_id: conversacion.id,
              tipo: accion.tipoCambio,
              detalle: accion.detalle,
              nueva_direccion: accion.nuevaDireccion,
              nueva_referencia: accion.nuevaReferencia,
              nueva_zona_id: accion.nuevaZonaId ? BigInt(accion.nuevaZonaId) : null,
              nueva_zona_nombre: accion.nuevaZonaNombre,
              nuevo_envio: accion.nuevoEnvio != null ? accion.nuevoEnvio : null,
              recargo_envio: accion.recargoEnvio != null ? accion.recargoEnvio : null,
              lat: accion.lat != null ? accion.lat : null,
              lng: accion.lng != null ? accion.lng : null,
              estado: 'PENDIENTE',
            },
          });

          // Notificación campana para Caja y Admin
          const tituloNotif = `Solicitud de cambio: ${accion.pedidoCodigo} (${accion.tipoCambio})`;
          const mensajeNotif = `${accion.detalle} (${nombreMostrar}).`;

          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: null,
              titulo: tituloNotif,
              mensaje: mensajeNotif,
              enlace: '/admin/mensajes',
            },
          });

          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: tituloNotif,
          });

          this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });
        } catch (err: any) {
          this.logger.error(`Error registrando solicitud de cambio: ${err.message}`, err.stack);
        }
      } else if (accion.tipo === 'consultarIa') {
        let textoRespuesta = TEXTOS_IA.errorConsulta();
        let botonesEnvio = BOTONES_IA_ESTANDAR;
        let esDerivacion = false;
        let motivoDeriv = 'CONSULTA_IA_FALLIDA';

        if (this.chatbotIaService) {
          try {
            // Historial corto (últimos 6 mensajes)
            const ultimosMensajes = await this.prisma.mensajeChat.findMany({
              where: { conversacion_id: conversacion.id },
              orderBy: { en: 'desc' },
              take: 6,
            });
            const historial = ultimosMensajes.reverse().map((m) => ({
              autor: m.autor,
              texto: (m.contenido as any)?.texto || '',
            }));

            const resIa = await this.chatbotIaService.procesarConsulta({
              textoUsuario: accion.pregunta,
              conversacionId: conversacion.id,
              telefonoCliente,
              primerNombre: nombreMostrar,
              historialReciente: historial,
              waMessageId: entradaRaw.waMessageId,
            });

            textoRespuesta = resIa.respuestaTexto;
            esDerivacion = resIa.necesitaDerivar || !resIa.exito;
            motivoDeriv = resIa.motivoDerivacion || 'CONSULTA_IA_DERIVADA';

            if (resIa.quierePedir) {
              botonesEnvio = BOTONES_IA_CON_PEDIDO;
            }
          } catch (err: any) {
            this.logger.error(`Error procesando consulta con ChatbotIaService: ${err.message}`, err.stack);
            textoRespuesta = TEXTOS_IA.errorConsulta();
            esDerivacion = true;
          }
        } else {
          textoRespuesta = TEXTOS_IA.iaApagadaODerivada();
          esDerivacion = true;
        }

        if (esDerivacion) {
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

          const tituloNotif = `Atención en WhatsApp: duda de cliente (${nombreMostrar})`;
          const mensajeNotif = `Consulta del cliente: "${accion.pregunta.slice(0, 100)}". Requiere atención de un asesor (${motivoDeriv}).`;

          const notif = await this.prisma.notificacion.create({
            data: {
              tipo: 'ATENCION_WHATSAPP',
              rol_destino: null,
              titulo: tituloNotif,
              mensaje: mensajeNotif,
              enlace: '/admin/mensajes',
            },
          });

          this.eventos?.emitirAdmin('notificaciones:nueva', {
            id: notif.id.toString(),
            titulo: tituloNotif,
          });
        }

        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarBotones(
            destinoEnvio,
            textoRespuesta,
            botonesEnvio,
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
              texto: textoRespuesta,
              botones: botonesEnvio,
            } as any,
            meta_id: metaId,
          },
        });
      }
    }

    // 10. Persistir el nuevo flujo en la conversación
    const flujoPersistir: FlujoConversacion = {
      ...resultado.nuevoFlujo,
      ultimo_wa_message_id: entradaRaw.waMessageId || undefined,
    };

    const dataUpdate: any = {
      flujo: flujoPersistir,
      ultima_actividad: new Date(),
    };
    if (esValidarPago) {
      dataUpdate.estado = 'VALIDAR_PAGO';
      dataUpdate.duenio = 'PERSONA';
    }

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: dataUpdate,
    });

    // 11. Notificar por WebSocket a la consola de Mensajes
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });

    return true;
  }
}
