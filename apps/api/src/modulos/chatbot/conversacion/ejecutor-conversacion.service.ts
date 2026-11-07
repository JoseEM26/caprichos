import { PuntosService } from '../../clientes/puntos.service';
import { CUENTA_CLIENTE_BOT_PUERTO, CuentaClienteBotPuerto } from '../puerto/cuenta-cliente-bot.puerto';
import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { LocalService } from '../../local/local.service';
import { CatalogoService } from '../../catalogo/catalogo.service';
import { enviarCarruselConRespaldo, resumenCarrusel, urlPublicaCarta } from '../servicios/carrusel.util';
import { OfertasService } from '../../ofertas/ofertas.service';
import { SeguimientoService } from '../../pedidos/seguimiento.service';
import { PedidosService } from '../../pedidos/pedidos.service';
import { ZonasService } from '../../zonas/zonas.service';
import { ReservasService } from '../../reservas/reservas.service';
import { textosNotificacionSolicitud } from '../../reservas/notificacion-solicitud';
import { ChatbotIaService } from '../ia/chatbot-ia.service';
import { ChatbotConfiguracionService } from '../configuracion/chatbot-configuracion.service';
import { BOTON_VOLVER_MENU, TEXTOS_BOT, TEXTOS_SOLO_MENUS, TEXTO_ASISTIDO_FRASE_FIJA } from './textos-bot';
import { vistaPreviaPedidoBot, vistaPreviaUbicacionBot } from './vista-previa-pedido.util';
import { EstadoCarritoPedido } from './flujos/pedido/tipos-pedido';
import { CODIGOS_COMBO_RECHAZADO, carritoTrasComboRechazado, carritoTrasSaborAgotado } from './flujos/pedido/flujo-pedido';
import { productosComboNoBot } from './flujos/pedido/combo-bot';
import { ofertasFueraDeWhatsapp } from '../utilidades/ofertas-canal.util';
import { TEXTOS_RESERVA } from './textos-reserva';
import { TEXTOS_IA, BOTONES_IA_ESTANDAR, BOTONES_IA_CON_PEDIDO } from './textos-ia';
import {
  buscarOfertaParaProducto,
  generarCierreComercial,
  adjuntarCierreComercial,
  validarYCorregirPreciosIa,
  limpiarFrasesPasivasIa,
} from './cierre-comercial.util';
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
import { detalleDatosPago } from './flujos/pago/textos-pago';
import { EntradaRawInput, normalizarEntrada, esSaludo } from './normalizador-entrada.util';
import { transicionarEstado } from './maquina-estados';
import {
  AccionMensaje,
  ContextoConversacion,
  VistaPreviaPedidoBot,
  DatosHorarioLocal,
  FlujoConversacion,
} from './tipos-conversacion';
import { obtenerFechaHoraLima } from '../../local/local.util';
import { DireccionesClienteService } from '../../clientes/direcciones-cliente.service';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';
import { topePedidosSinPagarAlcanzado, textoTopePedidosSinPagar } from '../servicios/tope-pedidos-sin-pagar.util';
import {
  leerExpiraPagoMin,
  motivoSalidaValidarPago,
  pedidoIdDePago,
  sacarDeValidarPago,
} from './validar-pago-salida.util';

export interface EntradaProcesarMensaje extends EntradaRawInput {
  waMessageId?: string;
  telefono?: string;
  telMask?: string;
  id?: string;
}

/** Mensajes sobre total, monto o dónde pagar (sin tildes, en minúsculas). */
const TEMA_DATOS_PAGO = /total|monto|precio|cuanto|yape|plin|numero|cuenta|donde (pago|pagar|deposito|yapeo)|transferenc|deposit/;

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
    @Optional() private readonly direccionesService?: DireccionesClienteService,
    @Optional() private readonly outbox?: OutboxWhatsappService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() @Inject(CUENTA_CLIENTE_BOT_PUERTO) private readonly clientesService?: CuentaClienteBotPuerto,
  ) {}

  /**
   * Origen del pedido de WhatsApp: los puntos van SIEMPRE al celular de quien escribe. El bot no acepta otro número
   * (el de contacto para la entrega nunca suma puntos) ni ofrece canjear.
   */
  private origenPedidoWhatsapp(conversacion: { telefono: string }): {
    canal: 'WHATSAPP';
    telefonoRemitente: string;
    telefonoPuntos: string;
  } {
    return { canal: 'WHATSAPP', telefonoRemitente: conversacion.telefono, telefonoPuntos: conversacion.telefono };
  }

  /**
   * Delivery con ubicación y sin dirección escrita: la calle aproximada es la que el webhook ya sacó de esa
   * ubicación del chat (direccionAprox, Nominatim). Así el pedido y el reparto la muestran. Nunca lanza.
   */
  private async conCalleDeLaUbicacion<T extends { modalidad?: string; entrega?: any }>(dto: T, conversacionId: bigint): Promise<T> {
    const entrega = dto?.entrega;
    if (dto?.modalidad !== 'DELIVERY' || entrega?.lat == null || entrega?.lng == null || entrega?.direccion) return dto;
    try {
      const recientes = await this.prisma.mensajeChat.findMany({
        where: { conversacion_id: conversacionId, direccion: 'ENTRA' },
        orderBy: { id: 'desc' },
        take: 10,
        select: { contenido: true },
      });
      const punto = recientes
        .map((m) => (m.contenido as any)?.ubicacion)
        .find((u) => u && Number(u.lat) === Number(entrega.lat) && Number(u.lng) === Number(entrega.lng));
      return punto?.direccionAprox ? { ...dto, entrega: { ...entrega, direccion: punto.direccionAprox } } : dto;
    } catch (err: any) {
      this.logger.warn(`No se pudo leer la calle de la ubicación: ${err.message}`);
      return dto;
    }
  }

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

  /** Deja en el chat del admin un evento interno visible con el motivo por el que el bot no respondió. */
  private async registrarSilencio(conversacionId: bigint, motivo: string): Promise<void> {
    try {
      await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: conversacionId,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: 'SISTEMA',
          contenido: { texto: `El bot no respondió. ${motivo}`, silencio: true } as any,
        },
      });
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacionId.toString() });
    } catch (err: any) {
      this.logger.warn(`No se pudo registrar el silencio del bot: ${err.message}`);
    }
  }

  /** Lee un parámetro numérico (minutos) con valor por defecto. */
  private async leerParametroNumero(clave: string, defecto: number): Promise<number> {
    try {
      if (typeof this.prisma.parametro?.findUnique === 'function') {
        const param = await this.prisma.parametro.findUnique({ where: { clave } });
        const val = Number(param?.valor);
        if (param && param.valor != null && !isNaN(val) && val >= 0) return val;
      }
    } catch (err: any) {
      this.logger.warn(`Error leyendo parametro ${clave}: ${err.message}`);
    }
    return defecto;
  }

  /** Minutos desde el mensaje anterior al que acaba de llegar (la actividad ya se actualizó con el entrante). */
  private async minutosDesdeActividadPrevia(conversacion: any): Promise<number> {
    let ref: Date | null = conversacion.ultima_actividad ? new Date(conversacion.ultima_actividad) : null;
    try {
      if (typeof this.prisma.mensajeChat?.findMany === 'function') {
        const ult = await this.prisma.mensajeChat.findMany({
          where: { conversacion_id: conversacion.id },
          orderBy: { en: 'desc' },
          take: 2,
          select: { en: true },
        });
        if (Array.isArray(ult)) ref = ult.length >= 2 ? new Date(ult[1].en) : null;
      }
    } catch {
      // sin historial se usa ultima_actividad
    }
    return ref ? (Date.now() - ref.getTime()) / 60000 : 0;
  }

  /**
   * Estados atascados: una conversación a medias (pedido, reserva, atención de persona sin persona...) con más de
   * `chatbot_estado_vencido_horas` (12) sin actividad vuelve a MENU. Con carrito saluda y absorbe el mensaje.
   */
  private async reiniciarFlujoAtascado(
    conversacion: any,
    flujo: FlujoConversacion | null,
  ): Promise<{ flujo: FlujoConversacion | null; saludoEnviado: boolean }> {
    const estado = String((flujo as any)?.estado || 'INICIO');
    if (['INICIO', 'MENU'].includes(estado) || conversacion.tomado_por != null) return { flujo, saludoEnviado: false };
    try {
      const horas = await this.leerParametroNumero('chatbot_estado_vencido_horas', 12);
      if (horas <= 0 || (await this.minutosDesdeActividadPrevia(conversacion)) < horas * 60) return { flujo, saludoEnviado: false };

      const conCarrito = Boolean((flujo as any)?.pedido?.items?.length);
      const nuevo: any = { ...(flujo as any), estado: 'MENU', pedido: null, repreguntasFallidas: 0 };
      const data: any = { flujo: nuevo };
      if (conversacion.motivo_derivacion !== 'CALIFICACION_BAJA') {
        data.duenio = 'BOT';
        data.urgente = false;
        data.motivo_derivacion = null;
      }
      await this.prisma.conversacion.update({ where: { id: conversacion.id }, data });
      Object.assign(conversacion, data);
      await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: conversacion.id,
          direccion: 'SALE',
          autor: 'BOT',
          tipo: 'SISTEMA',
          contenido: { texto: `La conversación estaba en «${estado}» desde hace más de ${horas} h: volvió al menú.` } as any,
        },
      });
      let saludoEnviado = false;
      const destino = normalizarTelefono(conversacion.telefono) || null;
      if (conCarrito && destino) {
        const texto = '¡Hola de nuevo! Tu pedido anterior quedó sin terminar. ¿Empezamos uno nuevo?';
        const botones = [
          { id: 'pedir', titulo: 'Empezar pedido' },
          { id: 'btn_menu', titulo: 'Ver menú' },
        ];
        await this.mensajeria.enviarBotones(destino, texto, botones, { conversacionId: conversacion.id });
        await this.prisma.mensajeChat.create({
          data: { conversacion_id: conversacion.id, direccion: 'SALE', autor: 'BOT', tipo: 'BOTON', contenido: { texto, botones } as any },
        });
        saludoEnviado = true;
      }
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });
      return { flujo: nuevo, saludoEnviado };
    } catch (err: any) {
      this.logger.warn(`No se pudo reiniciar el flujo atascado: ${err.message}`);
      return { flujo, saludoEnviado: false };
    }
  }

  /**
   * VALIDAR_PAGO que no se cierra: si el pedido que motivó la espera ya no espera validación
   * (pagado/rechazado, anulado, entregado, cancelado, inexistente o vencido) la conversación vuelve a MENU.
   * Devuelve el flujo vigente. Sin pedidoId en el flujo no se puede saber: se deja como está.
   */
  /** Pedido rechazado por stock: el carrito vuelve tal cual (estado PEDIDO_ACCION_CARRITO) y se avisa en un mensaje. */
  private async volverAlCarritoSinStock(
    conversacionId: bigint,
    carrito: any,
    mensaje: string,
    destinoEnvio: string | null | undefined,
    entradaRaw: any,
  ): Promise<void> {
    const actual = await this.prisma.conversacion.findUnique({ where: { id: conversacionId }, select: { flujo: true } });
    const flujoVuelta = {
      ...((actual?.flujo as any) || {}),
      estado: 'PEDIDO_ACCION_CARRITO',
      pedido: { ...carrito, estadoInterno: 'PEDIDO_ACCION_CARRITO' },
    };
    await this.prisma.conversacion.update({ where: { id: conversacionId }, data: { flujo: flujoVuelta as any } });
    const texto = `${mensaje} 😅 ¿Quieres ajustar tu pedido?`;
    const botones = [
      { id: 'ped_ver_carrito', titulo: 'Ajustar cantidad' },
      { id: 'ped_quitar', titulo: 'Quitar' },
      { id: 'btn_persona', titulo: 'Hablar con persona' },
    ];
    let metaId: string | null = null;
    if (destinoEnvio) {
      const res = await this.mensajeria.enviarBotones(destinoEnvio, texto, botones, {
        conversacionId,
        replyToWaMessageId: entradaRaw?.waMessageId,
      });
      metaId = res.waMessageId || null;
    }
    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor: 'BOT',
        tipo: 'BOTON',
        contenido: { texto, botones } as any,
        meta_id: metaId,
      },
    });
  }

  /**
   * Sabor agotado al confirmar: la línea de ese sabor sale del carrito y el cliente elige otro sabor en una lista
   * (un mensaje). Devuelve false si no se puede (sin línea o sin sabores): el llamador vuelve al carrito.
   */
  private async volverAlSaborAgotado(
    conversacionId: bigint,
    carrito: EstadoCarritoPedido,
    err: { productoId: string; saborId: string; saborNombre?: string },
    categorias: any[],
    destinoEnvio: string | null | undefined,
    entradaRaw: any,
  ): Promise<boolean> {
    const vuelta = carritoTrasSaborAgotado(carrito, err, categorias);
    if (!vuelta) return false;
    const actual = await this.prisma.conversacion.findUnique({ where: { id: conversacionId }, select: { flujo: true } });
    const flujoVuelta = {
      ...((actual?.flujo as any) || {}),
      estado: 'PEDIDO_SABOR',
      pedido: vuelta.pedido,
    };
    await this.prisma.conversacion.update({ where: { id: conversacionId }, data: { flujo: flujoVuelta as any } });
    const { lista } = vuelta;
    let metaId: string | null = null;
    if (destinoEnvio) {
      const res = await this.mensajeria.enviarLista(destinoEnvio, lista.texto, lista.botonTexto, lista.filas, {
        conversacionId,
        replyToWaMessageId: entradaRaw?.waMessageId,
      });
      metaId = res.waMessageId || null;
    }
    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: conversacionId,
        direccion: 'SALE',
        autor: 'BOT',
        tipo: 'LISTA',
        contenido: { texto: lista.texto, botonTexto: lista.botonTexto, filas: lista.filas } as any,
        meta_id: metaId,
      },
    });
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacionId.toString() });
    return true;
  }

  /** Combo rechazado al confirmar: el cliente vuelve a elegir sus partes (lista o botones) en un solo mensaje. */
  private async volverAlComboRechazado(
    conversacionId: bigint,
    vuelta: { pedido: EstadoCarritoPedido; acciones: AccionMensaje[] },
    destinoEnvio: string | null | undefined,
    entradaRaw: any,
  ): Promise<void> {
    const actual = await this.prisma.conversacion.findUnique({ where: { id: conversacionId }, select: { flujo: true } });
    await this.prisma.conversacion.update({
      where: { id: conversacionId },
      data: { flujo: { ...((actual?.flujo as any) || {}), estado: 'PEDIDO_COMBO_PARTE', pedido: vuelta.pedido } as any },
    });
    for (const a of vuelta.acciones) {
      const opciones = { conversacionId, replyToWaMessageId: entradaRaw?.waMessageId };
      let metaId: string | null = null;
      let tipo: 'TEXTO' | 'BOTON' | 'LISTA' = 'TEXTO';
      let contenido: any = {};
      if (a.tipo === 'enviarTexto') {
        if (destinoEnvio) metaId = (await this.mensajeria.enviarTexto(destinoEnvio, a.texto, opciones)).waMessageId || null;
        contenido = { texto: a.texto };
      } else if (a.tipo === 'enviarBotones') {
        if (destinoEnvio) metaId = (await this.mensajeria.enviarBotones(destinoEnvio, a.texto, a.botones, opciones)).waMessageId || null;
        tipo = 'BOTON';
        contenido = { texto: a.texto, botones: a.botones };
      } else if (a.tipo === 'enviarLista') {
        if (destinoEnvio) metaId = (await this.mensajeria.enviarLista(destinoEnvio, a.texto, a.botonTexto, a.filas, opciones)).waMessageId || null;
        tipo = 'LISTA';
        contenido = { texto: a.texto, botonTexto: a.botonTexto, filas: a.filas };
      } else continue;
      await this.prisma.mensajeChat.create({
        data: { conversacion_id: conversacionId, direccion: 'SALE', autor: 'BOT', tipo, contenido, meta_id: metaId },
      });
    }
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacionId.toString() });
  }

  private async salirDeValidarPagoSiVencido(conversacion: any, flujo: FlujoConversacion | null): Promise<FlujoConversacion | null> {
    const pedidoId = pedidoIdDePago(flujo);
    if (!pedidoId || typeof this.prisma.pedido?.findUnique !== 'function') return flujo;
    try {
      const pedido: any = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
      const motivo = motivoSalidaValidarPago(
        pedido,
        (flujo as any)?.pago,
        new Date(),
        await leerExpiraPagoMin(this.prisma),
      );
      if (!motivo) return flujo;

      const { flujo: nuevoFlujo, data } = await sacarDeValidarPago(this.prisma, conversacion, flujo, motivo);
      Object.assign(conversacion, data);
      this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });
      return nuevoFlujo;
    } catch (err: any) {
      this.logger.warn(`No se pudo revisar el pedido de VALIDAR_PAGO: ${err.message}`);
      return flujo;
    }
  }

  /**
   * Toque viejo: un botón/lista `ped_*` que el último mensaje interactivo del bot ya no ofrece.
   * Devuelve ese último mensaje (para re-mostrar el paso actual) o null si el toque corresponde.
   */
  private async ultimoPasoSiToqueViejo(conversacionId: bigint, idToque?: string | null): Promise<any | null> {
    if (!idToque || !idToque.startsWith('ped_') || typeof this.prisma.mensajeChat?.findMany !== 'function') return null;
    try {
      const ult = await this.prisma.mensajeChat.findMany({
        where: { conversacion_id: conversacionId, direccion: 'SALE', autor: 'BOT', tipo: { in: ['BOTON', 'LISTA'] } },
        orderBy: { id: 'desc' },
        take: 4, // carrusel + botones «Ver más», y la página anterior: los toques de cualquiera de los últimos valen
      });
      const c: any = ult?.[0]?.contenido;
      if (!c) return null;
      const ids = ult.flatMap((m: any) => [...(m.contenido?.botones ?? []), ...(m.contenido?.filas ?? [])]).map((x: any) => x?.id);
      if (!ids.length || ids.includes(idToque)) return null;
      return c;
    } catch {
      return null;
    }
  }

  /**
   * Obtiene el parámetro de espera antes de activar el Modo Asistido (defecto 3 min).
   */
  private async obtenerAsistidoEsperaMin(): Promise<number> {
    try {
      if (typeof this.prisma.parametro?.findUnique === 'function') {
        const param = await this.prisma.parametro.findUnique({
          where: { clave: 'asistido_espera_min' },
        });
        if (param && param.valor != null) {
          const val = Number(param.valor);
          if (!isNaN(val) && val > 0) return val;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error leyendo parametro asistido_espera_min: ${err.message}`);
    }
    return 3;
  }

  /**
   * Verifica si la frase fija del modo asistido ya fue enviada en los últimos 3 minutos (Regla 4).
   */
  private async verificarFraseFijaReciente(
    conversacionId: string | bigint,
    flujo: any,
  ): Promise<boolean> {
    const clave = `rate:asistido:frase_fija:${conversacionId.toString()}`;
    try {
      const redis = this.redisService?.obtenerCliente();
      if (redis && typeof redis.get === 'function') {
        const val = await redis.get(clave);
        if (val) return true;
      }
    } catch { /* si Redis falla, el bot sigue sin el candado de asistido */ }

    if (flujo?.asistido_ultima_frase_fija_ts) {
      const ms = Date.now() - Number(flujo.asistido_ultima_frase_fija_ts);
      if (ms < 3 * 60 * 1000) return true;
    }
    return false;
  }

  /**
   * Registra en Redis el envío de la frase fija del modo asistido con TTL de 3 minutos (Regla 4).
   */
  private async registrarFraseFijaEnviada(
    conversacionId: string | bigint,
    asistidoEsperaMin = 3,
  ): Promise<void> {
    const clave = `rate:asistido:frase_fija:${conversacionId.toString()}`;
    try {
      const redis = this.redisService?.obtenerCliente();
      if (redis && typeof redis.set === 'function') {
        await redis.set(clave, '1', 'EX', asistidoEsperaMin * 60);
      }
    } catch { /* si Redis falla, el bot sigue sin marcar la espera */ }
  }

  /**
   * Determina si la entrada corresponde a una petición de acción inmediata permitida en Modo Asistido (Regla 1).
   */
  private esAccionInmediataAsistido(entrada: EntradaProcesarMensaje): boolean {
    const id = String(
      entrada.buttonPayload ||
        entrada.listReplyId ||
        entrada.listRowId ||
        (entrada as any).id ||
        '',
    ).trim();
    const textoNorm = (entrada.texto || entrada.textoOriginal || '').trim().toLowerCase();

    // Menú
    if (
      ['menu', 'btn_menu', 'volver_menu', 'inicio', '0'].includes(id) ||
      esSaludo(textoNorm) ||
      textoNorm === 'menu' ||
      textoNorm === 'inicio' ||
      textoNorm === '0'
    )
      return true;
    // Carta
    if (
      id === 'carta' ||
      id === 'btn_carta' ||
      id === 'btn_asi_carta' ||
      id.startsWith('cat_') ||
      textoNorm === 'carta' ||
      textoNorm.includes('ver la carta') ||
      textoNorm.includes('ver carta') ||
      textoNorm === 'la carta'
    )
      return true;
    // Nuevo pedido
    if (
      ['pedir', 'btn_pedir', 'delivery', 'recojo'].includes(id) ||
      id.startsWith('ped_') ||
      textoNorm === 'pedir' ||
      textoNorm.includes('nuevo pedido')
    )
      return true;
    // Mi pedido / Estado
    if (
      ['mipedido', 'btn_mipedido', 'btn_asi_pedido'].includes(id) ||
      id.startsWith('ord_') ||
      textoNorm.includes('mi pedido') ||
      textoNorm.includes('estado') ||
      Boolean(textoNorm.match(/cp-\d{4}/i))
    )
      return true;
    // Horario / Ubicación / FAQ
    if (
      ['horario', 'btn_horario', 'ubicacion', 'btn_ubicacion'].includes(id) ||
      id.startsWith('faq_') ||
      textoNorm.includes('horario') ||
      textoNorm.includes('ubicacion') ||
      textoNorm.includes('donde estan') ||
      textoNorm.includes('a que hora')
    )
      return true;
    // Hablar con persona
    if (
      ['persona', 'btn_persona', 'btn_asi_persona'].includes(id) ||
      textoNorm === 'asesor' ||
      textoNorm.includes('persona') ||
      textoNorm.includes('hablar con persona') ||
      textoNorm.includes('hablar con alguien') ||
      textoNorm.includes('hablar con asesor')
    )
      return true;
    // Cancelar o cambiar
    if (
      ['c_dir', 'c_ped', 'c_ped_si', 'c_dir_si'].includes(id) ||
      id.startsWith('c_dir_') ||
      id.startsWith('c_ped_') ||
      textoNorm.includes('cancelar') ||
      textoNorm.includes('anular') ||
      textoNorm.includes('cambiar') ||
      textoNorm.includes('ya no quiero')
    )
      return true;

    return false;
  }

  /**
   * Identifica si la consulta a la IA trata sobre un producto concreto o sobre varios productos,
   * cruzando el resultado de las herramientas con el catálogo de productos disponibles.
   */
  private identificarProductosConsulta(
    textoPregunta: string,
    textoRespuesta: string,
    categorias: any[],
    resIa?: any,
  ): { productoConcreto?: any; productosMultiples?: any[] } {
    if (resIa?.productoConcreto) {
      const pNombre = (resIa.productoConcreto.nombre || '').toLowerCase();
      for (const cat of categorias) {
        const encontrado = (cat.productos || []).find(
          (p: any) =>
            p.nombre.toLowerCase() === pNombre ||
            String(p.id) === String(resIa.productoConcreto.id),
        );
        if (encontrado) {
          return { productoConcreto: { ...encontrado, categoriaId: cat.id } };
        }
      }
      return { productoConcreto: resIa.productoConcreto };
    }

    const textoCompleto = `${textoPregunta || ''} ${textoRespuesta || ''}`.toLowerCase();
    const productosCoincidentes: any[] = [];

    for (const cat of categorias) {
      for (const prod of cat.productos || []) {
        const nombreProd = (prod.nombre || '').toLowerCase();
        if (
          nombreProd &&
          nombreProd.length >= 3 &&
          (textoPregunta.toLowerCase().includes(nombreProd) ||
            textoRespuesta.toLowerCase().includes(nombreProd))
        ) {
          productosCoincidentes.push({ ...prod, categoriaId: cat.id });
        }
      }
    }

    if (productosCoincidentes.length === 1) {
      return { productoConcreto: productosCoincidentes[0] };
    }

    if (productosCoincidentes.length > 1) {
      return { productosMultiples: productosCoincidentes };
    }

    if (resIa?.productosConsultados && resIa.productosConsultados.length > 1) {
      return { productosMultiples: resIa.productosConsultados };
    }

    return {};
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

    // 2. Control de atención y Modo Asistido (Contrato Modo Asistido 27/10/2026):
    let flujoPrevio = (conversacion.flujo as any) as FlujoConversacion | null;
    // Rescate: chat que una persona ya soltó (dueño BOT, sin tomar) pero cuyo flujo quedó en ATENCION_PERSONA
    // por un error anterior: vuelve al menú para que el bot responda en vez de callar para siempre.
    if (conversacion.duenio === 'BOT' && conversacion.tomado_por === null && flujoPrevio?.estado === 'ATENCION_PERSONA') {
      flujoPrevio = { ...(flujoPrevio as any), estado: 'MENU', repreguntasFallidas: 0 } as FlujoConversacion;
      (conversacion as any).flujo = flujoPrevio as any;
      try {
        await this.prisma.conversacion.update({ where: { id: conversacion.id }, data: { flujo: flujoPrevio as any } });
      } catch (err: any) {
        this.logger.warn(`No se pudo rescatar el flujo de la conversación ${conversacionId}: ${err.message}`);
      }
    }
    if (conversacion.estado === 'VALIDAR_PAGO') {
      flujoPrevio = await this.salirDeValidarPagoSiVencido(conversacion, flujoPrevio);
    }
    const esValidarPago = conversacion.estado === 'VALIDAR_PAGO';
    if (!esValidarPago) {
      const res = await this.reiniciarFlujoAtascado(conversacion, flujoPrevio);
      flujoPrevio = res.flujo;
      if (res.saludoEnviado) return true;
    }
    const enManosDePersona =
      conversacion.duenio !== 'BOT' ||
      conversacion.tomado_por !== null ||
      flujoPrevio?.estado === 'ATENCION_PERSONA';

    let esModoAsistido = false;
    let asistidoEsperaMin = 3;
    let minutosSinHumano = 0;
    let esEsperaCumplida = false;

    if (enManosDePersona && !esValidarPago) {
      // Regla 5: Si la conversación está TOMADA (tomado_por) por alguien activo, el bot calla
      if (conversacion.tomado_por !== null) {
        this.logger.log(`Conversación ${conversacionId} tomada por persona (${conversacion.tomado_por}). El bot calla.`);
        return false; // la persona ve el mensaje en su chat: no hace falta evento
      }

      asistidoEsperaMin = await this.obtenerAsistidoEsperaMin();

      // Regla 1 y 5: Si una persona envió un mensaje al cliente en los últimos N minutos, el bot calla
      const ultimoMensajePersona =
        typeof this.prisma.mensajeChat?.findFirst === 'function'
          ? await this.prisma.mensajeChat.findFirst({
              where: {
                conversacion_id: conversacion.id,
                direccion: 'SALE',
                autor: 'PERSONA',
              },
              orderBy: { en: 'desc' },
            })
          : null;

      let minutosDesdeUltimoHumano = Infinity;
      if (ultimoMensajePersona) {
        minutosDesdeUltimoHumano =
          (Date.now() - new Date(ultimoMensajePersona.en).getTime()) / (60 * 1000);
      }

      // Una acción directa del cliente (menú, carta, pedir) se atiende aunque la persona haya escrito hace poco;
      // solo el chat tomado (arriba) mantiene al bot callado.
      if (minutosDesdeUltimoHumano < asistidoEsperaMin && !this.esAccionInmediataAsistido(entradaRaw)) {
        this.logger.log(
          `Persona escribió hace ${minutosDesdeUltimoHumano.toFixed(1)} min (< ${asistidoEsperaMin} min). El bot calla.`,
        );
        await this.registrarSilencio(conversacion.id, `Modo asistido: una persona escribió hace ${minutosDesdeUltimoHumano.toFixed(1)} min (espera ${asistidoEsperaMin} min).`);
        return false;
      }

      minutosSinHumano = ultimoMensajePersona
        ? minutosDesdeUltimoHumano
        : conversacion.ultima_actividad
          ? (Date.now() - new Date(conversacion.ultima_actividad).getTime()) / (60 * 1000)
          : 0;

      esEsperaCumplida = minutosSinHumano >= asistidoEsperaMin;
      const esAccionInmediata = this.esAccionInmediataAsistido(entradaRaw);

      // Si no han pasado N minutos y no es una acción inmediata (menú, carta, pedir, etc.), el bot calla
      if (!esEsperaCumplida && !esAccionInmediata) {
        this.logger.log(
          `Modo asistido en conversación ${conversacionId}: no han transcurrido ${asistidoEsperaMin} min (${minutosSinHumano.toFixed(1)} min) y no es acción directa. El bot calla.`,
        );
        await this.registrarSilencio(conversacion.id, `Modo asistido: aún no pasan ${asistidoEsperaMin} min sin respuesta de una persona.`);
        return false;
      }

      esModoAsistido = true;
    }

    // 3. Verificar interruptor general chatbot_activo === 'si'
    const activo = await this.estaChatbotActivo();
    if (!activo) {
      this.logger.log(`Chatbot apagado por configuración (chatbot_activo != 'si').`);
      await this.registrarSilencio(conversacion.id, 'El chatbot está apagado (chatbot_activo).');
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
        await this.registrarSilencio(
          conversacion.id,
          antiSpamCheck.bloqueado ? 'Anti-spam: el contacto está bloqueado temporalmente.' : 'Anti-spam: demasiados mensajes por minuto/hora; el bot no respondió.',
        );
        return false;
      }
    }

    // 5. Rate limit general: máximo 5 respuestas por minuto
    // Los toques de botón/lista (avanzar el flujo) no cuentan: un pedido normal supera 5 toques por minuto.
    const esToqueInteractivo = Boolean(entradaRaw.buttonPayload || entradaRaw.listReplyId || entradaRaw.listRowId);
    const permitidoRateLimit = esToqueInteractivo ? true : await this.verificarRateLimit(conversacion.id);
    if (!permitidoRateLimit) {
      this.logger.warn(
        `Límite de 5 respuestas por minuto excedido para la conversación ${conversacion.id}. Silenciando respuesta temporalmente.`,
      );
      await this.registrarSilencio(conversacion.id, 'Límite de 5 mensajes de texto por minuto: el bot no respondió.');
      return false;
    }

    // 6. Preparar datos del contexto consumiendo servicios y la Base de Datos
    const nombreMostrar = obtenerNombreMostrar(conversacion);
    const cartaUrlPublica = urlPublicaCarta((k) => this.configService.get<string>(k));
    const telefonoCliente = normalizarTelefono(conversacion.telefono);

    let errorServicio = false;
    let datosLocal: DatosHorarioLocal | undefined;
    let datosLocalPublicos: any = null;
    let categoriasCarta: any[] = [];
    let ofertas: any[] = [];
    let promosFuera: ReturnType<typeof ofertasFueraDeWhatsapp> = { soloWeb: [], soloLocal: [] };
    let anfitrionesNoBot: string[] = [];
    let ventasProductos: Record<string, number> = {};
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

      try {
        ventasProductos = (await this.catalogoService?.ventasPorProducto?.()) ?? {};
      } catch (err: any) {
        this.logger.warn(`Sin ranking de ventas para ordenar el carrusel: ${err.message}`);
      }

      if (this.ofertasService) {
        ofertas = await this.ofertasService.listarOfertas(undefined, true, 'WHATSAPP');
        // Anfitriones de combos que el bot no vende hoy (sin casilla WhatsApp, agotados o fuera de horario): no salen en sus listas
        try {
          // Todas las activas (sin filtrar canal): de ahí salen los combos que el bot no vende y las promos solo web o solo local
          const todasActivas = (await this.ofertasService.listarOfertas(undefined, true)) ?? [];
          anfitrionesNoBot = productosComboNoBot(todasActivas.filter((o: any) => o.tipo === 'COMBO'), ofertas);
          promosFuera = ofertasFueraDeWhatsapp(todasActivas);
        } catch (err: any) {
          this.logger.warn(`Sin la lista de combos para filtrar la carta del bot: ${err.message}`);
        }
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

    // Puntos: la cuenta del propio número de quien escribe (con saldo). El bot no acepta otro número para puntos
    let puntosCtx: ContextoConversacion['puntos'] = undefined;
    const estadoPrevio = String(flujoPrevio?.estado ?? '');
    const textoEntradaPuntos = normalizarEntrada(entradaRaw);
    const tocaPuntos =
      estadoPrevio.startsWith('PEDIDO_') ||
      textoEntradaPuntos.id === 'mispuntos' ||
      textoEntradaPuntos.id === 'pedir' ||
      /punto/.test(textoEntradaPuntos.texto ?? '');
    if (this.direccionesService && this.puntosService && tocaPuntos) {
      try {
        const [propia, param] = await Promise.all([
          this.direccionesService.cuentaPorTelefono(conversacion.telefono),
          this.prisma.parametro.findUnique({ where: { clave: 'puntos_porcentaje' } }).catch(() => null),
        ]);
        puntosCtx = {
          porcentaje: param && param.valor !== null && param.valor !== undefined ? Number(param.valor) : 5,
          cuentaTelefono: propia
            ? { partyId: propia.partyId.toString(), primerNombre: propia.primerNombre, saldo: await this.puntosService.obtenerSaldo(propia.partyId) }
            : null,
        };
      } catch (err: any) {
        this.logger.warn(`Error consultando puntos del cliente: ${err.message}`);
        puntosCtx = undefined;
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

    // La IA solo entra como ayuda antes del «no entendí» del bot con menú; requiere chatbot_ia_activo = 'si'
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

    // Vista previa del pedido en curso con las reglas del servidor (promo BOT y envío): el total del bot sale de aquí
    let vistaPreviaPedido: VistaPreviaPedidoBot | null = null;
    const pedidoEnCurso = flujoPrevio?.pedido as EstadoCarritoPedido | undefined;
    if (pedidoEnCurso?.items?.length) {
      try {
        vistaPreviaPedido = await vistaPreviaPedidoBot(
          { prisma: this.prisma, ofertasService: this.ofertasService },
          pedidoEnCurso,
          resultadoEnvio?.tarifa ?? pedidoEnCurso.entrega?.tarifaZona ?? null,
        );
      } catch (err: any) {
        this.logger.warn(`Sin vista previa del pedido (se cobra el precio de lista del servidor): ${err.message}`);
      }
    } else if (resultadoEnvio && pedidoEnCurso?.modalidad === 'DELIVERY') {
      // Ubicación antes del carrito: el envío de la zona (y la promo de envío) sale ya del servidor
      try {
        vistaPreviaPedido = await vistaPreviaUbicacionBot(this.prisma, resultadoEnvio.tarifa);
      } catch (err: any) {
        this.logger.warn(`Sin envío para la ubicación (queda por calcular): ${err.message}`);
      }
    }

    const contexto: ContextoConversacion = {
      conversacionId: conversacion.id.toString(),
      nombreCliente: nombreMostrar,
      telefonoCliente,
      cartaUrlPublica,
      vistaPreviaPedido,
      datosLocal,
      datosLocalPublicos,
      categoriasCarta,
      ofertas,
      ofertasSoloWeb: promosFuera.soloWeb,
      ofertasSoloLocal: promosFuera.soloLocal,
      productosComboNoBot: anfitrionesNoBot,
      ventasProductos,
      pedidoActivo,
      errorServicio,
      limiteConsultasExcedido,
      pedidosHoyTelefono,
      minutosInactividad,
      inactividadExpirada,
      resultadoEnvio,
      puntos: puntosCtx,
      franjasDisponiblesReserva,
      solicitudesPendientesTelefono,
      solicitudesCambioPendientesTelefono,
      reservasActivasCliente,
      chatbotIaActivo,
      funcionesActivas,
      textosPersonalizados,
      modoAsistido: esModoAsistido && esEsperaCumplida,
      asistidoEsperaMin,
      minutosSinHumano,
      modoAsistidoFraseReciente: esModoAsistido
        ? await this.verificarFraseFijaReciente(conversacion.id, flujoPrevio)
        : false,
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
        esSaludo(textoNorm) ||
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
        payload === 'mipedido' ||
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
        const urlCarta = contexto.cartaUrlPublica || 'https://caprichos.pe';
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
              rol_destino: 'CAJERO',
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

        // Pregunta por el total o por dónde pagar: se responde siempre (máx. 1 vez cada 5 min), sin tomar el chat.
        const textoPlano = (entradaRaw.texto || entradaRaw.textoOriginal || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const ultimaRespDatos = pago.respuestaDatosEn ? Date.parse(pago.respuestaDatosEn) : NaN;
        const datosRecientes = !isNaN(ultimaRespDatos) && Date.now() - ultimaRespDatos < 5 * 60000;
        if (destinoEnvio && !datosRecientes && TEMA_DATOS_PAGO.test(textoPlano)) {
          const total = Number(pago.monto ?? contexto.pedidoActivo?.total ?? 0);
          const medio = String(pago.medio || 'YAPE').toUpperCase();
          const respuesta =
            `El total de tu pedido${pago.pedidoCodigo ? ` ${pago.pedidoCodigo}` : ''} es S/ ${total.toFixed(2)}.\n` +
            `Método de pago: ${medio}\n\n` +
            `${detalleDatosPago(medio, contexto.datosLocalPublicos?.mediosPagoVisibles, total.toFixed(2))}\n\n` +
            `Envíanos la captura de tu pago por este mismo chat 📎 y una persona de Caja la revisa.`;
          await this.mensajeria.enviarTexto(destinoEnvio, respuesta, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
          await this.prisma.mensajeChat.create({
            data: { conversacion_id: conversacion.id, direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', contenido: { texto: respuesta } },
          });
          await this.prisma.conversacion.update({
            where: { id: conversacion.id },
            data: { flujo: { ...flujo, pago: { ...pago, respuestaDatosEn: new Date().toISOString() } } },
          });
          return true;
        }

        // Texto libre fuera de eso: avisa a Caja; si ya avisó hace poco calla pero deja el motivo en el chat.
        const reavisoMin = await this.leerParametroNumero('chatbot_pago_reaviso_min', 15);
        let ultimoAviso = pago.avisoPersonaEn ? Date.parse(pago.avisoPersonaEn) : NaN;
        const primera = !pago.avisoPersonaEnviado && isNaN(ultimoAviso);
        if (!primera && isNaN(ultimoAviso)) ultimoAviso = Date.now(); // booleano viejo: el reloj arranca ahora
        const vencido = !primera && Date.now() - ultimoAviso >= reavisoMin * 60000;

        if (!primera && !vencido) {
          this.logger.log(`Texto libre en VALIDAR_PAGO para conversación ${conversacion.id} ya tuvo aviso reciente. El bot guarda silencio.`);
          if (!pago.avisoPersonaEn) {
            await this.prisma.conversacion.update({
              where: { id: conversacion.id },
              data: { flujo: { ...flujo, pago: { ...pago, avisoPersonaEn: new Date(ultimoAviso).toISOString() } } },
            });
          }
          await this.registrarSilencio(conversacion.id, 'Pago en revisión, ya se avisó a Caja.');
          return true;
        }

        const respuesta = primera
          ? 'Ya avisé a una persona, te responde en breve.'
          : 'Seguimos revisando tu pago; una persona te responde en breve. Si quieres, puedes ver la carta o tu pedido.';
        const botones = primera
          ? null
          : [
              { id: 'btn_esp_carta', titulo: 'Ver la carta' },
              { id: 'mipedido', titulo: 'Mi pedido' },
              { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
            ];
        if (destinoEnvio) {
          if (botones) {
            await this.mensajeria.enviarBotones(destinoEnvio, respuesta, botones, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          } else {
            await this.mensajeria.enviarTexto(destinoEnvio, respuesta, {
              conversacionId: conversacion.id,
              replyToWaMessageId: entradaRaw.waMessageId,
            });
          }
        }
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: botones ? 'BOTON' : 'TEXTO',
            contenido: (botones ? { texto: respuesta, botones } : { texto: respuesta }) as any,
          },
        });

        const notif = await this.prisma.notificacion.create({
          data: {
            tipo: 'ATENCION_WHATSAPP',
            rol_destino: 'CAJERO',
            titulo: `Mensaje de cliente en chat con pago pendiente (${nombreMostrar})`,
            mensaje: `Cliente escribió: "${(entradaRaw.texto || entradaRaw.textoOriginal || '').slice(0, 100)}". Ya se le indicó que una persona le responde en breve.`,
            enlace: '/admin/mensajes',
          },
        });
        this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });

        await this.prisma.conversacion.update({
          where: { id: conversacion.id },
          data: {
            flujo: {
              ...flujo,
              pago: { ...pago, avisoPersonaEnviado: true, avisoPersonaEn: new Date().toISOString() },
            },
          },
        });
        return true;
      }

      if (payload === 'btn_esp_carta') {
        entradaRaw.buttonPayload = 'carta';
        entradaRaw.listRowId = 'carta';
        entradaRaw.texto = 'carta';
      }
    }

    // 7.c Toque viejo de un paso que ya pasó: respuesta amable re-mostrando el paso actual, sin tocar el flujo.
    const idToque = entradaRaw.buttonPayload || entradaRaw.listReplyId || entradaRaw.listRowId;
    const pasoActual = destinoEnvio ? await this.ultimoPasoSiToqueViejo(conversacion.id, idToque) : null;
    if (pasoActual && destinoEnvio) {
      const aviso = 'Ese botón es de un paso anterior. Seguimos aquí:';
      const texto = `${aviso}\n\n${pasoActual.texto ?? ''}`.trim();
      let res: any;
      if (pasoActual.filas?.length) {
        res = await this.mensajeria.enviarLista(destinoEnvio, texto, pasoActual.botonTexto || 'Elegir', pasoActual.filas.slice(0, 10), {
          conversacionId: conversacion.id, replyToWaMessageId: entradaRaw.waMessageId,
        });
      } else {
        res = await this.mensajeria.enviarBotones(destinoEnvio, texto, pasoActual.botones.slice(0, 3), {
          conversacionId: conversacion.id, replyToWaMessageId: entradaRaw.waMessageId,
        });
      }
      await this.prisma.mensajeChat.create({
        data: {
          conversacion_id: conversacion.id, direccion: 'SALE', autor: 'BOT',
          tipo: pasoActual.filas?.length ? 'LISTA' : 'BOTON',
          contenido: { ...pasoActual, texto } as any, meta_id: res?.waMessageId || null,
        },
      });
      await this.prisma.conversacion.update({
        where: { id: conversacion.id },
        data: { flujo: { ...(flujoPrevio || {}), ultimo_wa_message_id: entradaRaw.waMessageId || undefined } as any, ultima_actividad: new Date() },
      });
      return true;
    }

    // 8. Normalizar entrada y ejecutar la máquina de estados pura
    const entradaNorm = normalizarEntrada(entradaRaw);
    const flujoEntrada: FlujoConversacion = {
      ...(flujoPrevio || { version: 2, repreguntasFallidas: 0 }),
      estado:
        esModoAsistido &&
        (!flujoPrevio?.estado ||
          flujoPrevio.estado === 'INICIO' ||
          flujoPrevio.estado === 'MENU')
          ? 'ATENCION_PERSONA'
          : flujoPrevio?.estado || 'INICIO',
    };
    const resultado = transicionarEstado(flujoEntrada, entradaNorm, contexto);

    // 9.a Persistir el nuevo flujo ANTES de despachar los mensajes (un toque rápido siempre lee el estado correcto)
    // La marca de frase fija del modo asistido se decide antes de guardar
    if (resultado.acciones.some((a: any) => a.tipo === 'enviarBotones' && a.texto === TEXTO_ASISTIDO_FRASE_FIJA)) {
      (resultado.nuevoFlujo as any).asistido_ultima_frase_fija_ts = Date.now();
    }
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
    } else if (esModoAsistido) {
      // Regla 6: Al pasar a modo asistido NO se quita la urgencia ni se suelta el chat:
      // sigue en la lista Por atender (duenio: PERSONA) y con las alertas a administradores.
      dataUpdate.duenio = 'PERSONA';
      if (conversacion.urgente) {
        dataUpdate.urgente = true;
      }
    }

    await this.prisma.conversacion.update({
      where: { id: conversacion.id },
      data: dataUpdate,
    });

    // 9. Ejecutar las acciones devueltas por el motor
    let carruselSalio = false;
    for (const accion of resultado.acciones) {
      if ((accion as any).soloSiCarruselSalio && !carruselSalio) continue;
      if (accion.tipo === 'enviarCarrusel') {
        let metaId: string | null = null;
        let r: Awaited<ReturnType<typeof enviarCarruselConRespaldo>> | null = null;
        if (destinoEnvio) {
          // Meta baja las imágenes justo al recibir el carrusel: se dejan generadas antes de enviar
          const idsFotos = accion.carga.tarjetas.map((t) => /\/productos\/(\d+)\/imagen-wa\.jpg/.exec(t.imagenUrl ?? '')?.[1]).filter(Boolean) as string[];
          if (idsFotos.length) await this.catalogoService?.calentarImagenesWhatsApp?.(idsFotos, this.configService.get<string>('UPLOADS_DIR') || undefined);
          r = await enviarCarruselConRespaldo(this.mensajeria, destinoEnvio, accion.carga, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
          metaId = r.waMessageId || null;
        }
        const comoCarrusel = !r?.respaldo;
        if (r?.motivoRespaldo) {
          await this.prisma.mensajeChat.create({
            data: {
              conversacion_id: conversacion.id,
              direccion: 'SALE',
              autor: 'BOT',
              tipo: 'SISTEMA',
              contenido: { texto: `El carrusel no salió (${r.motivoRespaldo}); se envió la lista.` } as any,
            },
          });
        }
        carruselSalio = carruselSalio || comoCarrusel;
        const rp = accion.carga.respaldo;
        // Registro legible para el admin; los ids de «Pedir este» quedan en botones para detectar toques viejos
        await this.prisma.mensajeChat.create({
          data: {
            conversacion_id: conversacion.id,
            direccion: 'SALE',
            autor: 'BOT',
            tipo: comoCarrusel ? 'BOTON' : rp?.filas?.length ? 'LISTA' : 'BOTON',
            contenido: (comoCarrusel
              ? { texto: resumenCarrusel(accion.carga), carrusel: true, respaldo: rp ?? null, botones: accion.carga.tarjetas.map((t) => ({ id: t.boton.id, titulo: t.nombre })) }
              : { texto: rp?.texto, botonTexto: rp?.botonTexto, filas: rp?.filas, botones: rp?.botones, carruselRespaldo: true }) as any,
            meta_id: metaId,
          },
        });
        continue;
      }
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
      } else if (accion.tipo === 'crearCuentaCliente') {
        // Cuenta sin contraseña con el celular de la conversación; el texto sale por el mismo camino que cualquier respuesta del bot
        let texto: string;
        try {
          if (!this.clientesService) throw new Error('ClientesService no disponible');
          const r = await this.clientesService.crearCuentaDesdeBot(conversacion.telefono, accion.nombre);
          texto = TEXTOS_BOT.cuentaCreada(r.primerNombre);
        } catch (err: any) {
          this.logger.warn(`No se pudo crear la cuenta del cliente desde el bot: ${err.message}`);
          texto = TEXTOS_BOT.cuentaNoCreada();
        }
        let metaId: string | null = null;
        if (destinoEnvio) {
          const res = await this.mensajeria.enviarTexto(destinoEnvio, texto, {
            conversacionId: conversacion.id,
            replyToWaMessageId: entradaRaw.waMessageId,
          });
          metaId = res.waMessageId || null;
        }
        await this.prisma.mensajeChat.create({
          data: { conversacion_id: conversacion.id, direccion: 'SALE', autor: 'BOT', tipo: 'TEXTO', contenido: { texto }, meta_id: metaId },
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

        if (accion.texto === TEXTO_ASISTIDO_FRASE_FIJA) {
          await this.registrarFraseFijaEnviada(conversacion.id, asistidoEsperaMin);
        }
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
        // Tope: no más de N pedidos por WhatsApp sin pagar por número. No se crea el pedido.
        const tope = await topePedidosSinPagarAlcanzado(this.prisma, conversacion.telefono);
        if (tope.alcanzado) {
          const textoTope = textoTopePedidosSinPagar(tope.max);
          const botonesTope = [
            { id: 'mipedido', titulo: 'Ver mis pedidos' },
            { id: 'btn_persona', titulo: 'Hablar con una persona' },
          ];
          let metaTope: string | null = null;
          if (destinoEnvio && this.outbox) {
            // Por el outbox interactivo: reintentos, ventana de 24 h y registro en el chat
            await this.outbox.encolar({
              telefono: destinoEnvio,
              tipo: 'INTERACTIVO',
              clave: `tope-sin-pagar-${conversacion.id}-${entradaRaw.waMessageId || Date.now()}`,
              origen: 'TOPE_SIN_PAGAR',
              carga: {
                textoLibre: textoTope,
                autor: 'BOT',
                etapa: 'TOPE_SIN_PAGAR',
                interactivo: { cuerpo: textoTope, botones: botonesTope },
              },
            });
            this.outbox.despertar();
          } else {
            if (destinoEnvio) {
              const res = await this.mensajeria.enviarBotones(destinoEnvio, textoTope, botonesTope, {
                conversacionId: conversacion.id,
                replyToWaMessageId: entradaRaw.waMessageId,
              });
              metaTope = res.waMessageId || null;
            }
            await this.prisma.mensajeChat.create({
              data: {
                conversacion_id: conversacion.id,
                direccion: 'SALE',
                autor: 'BOT',
                tipo: 'BOTON',
                contenido: { texto: textoTope, botones: botonesTope } as any,
                meta_id: metaTope,
              },
            });
          }
          // Equipo: una notificación por número cada 24 h
          const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const yaAvisado = await this.prisma.notificacion.findFirst({
            where: { tipo: 'PEDIDOS_SIN_PAGAR_TOPE', en: { gte: hace24h }, mensaje: { contains: `(conv ${conversacion.id})` } },
            select: { id: true },
          });
          if (!yaAvisado) {
            const tituloTope = `Pedidos sin pagar al tope (${nombreMostrar})`;
            const notifTope = await this.prisma.notificacion.create({
              data: {
                tipo: 'PEDIDOS_SIN_PAGAR_TOPE',
                rol_destino: null,
                titulo: tituloTope,
                mensaje: `Este número ya tiene ${tope.max} pedidos por WhatsApp sin pagar. No se creó otro pedido (conv ${conversacion.id}).`,
                enlace: '/admin/mensajes',
              },
            });
            this.eventos?.emitirAdmin('notificaciones:nueva', { id: notifTope.id.toString(), titulo: tituloTope });
          }
          continue;
        }

        let codigoFinal = 'CP-0000';
        try {
          if (this.pedidosService) {
            const pedidoCreado = await this.pedidosService.crear(
              await this.conCalleDeLaUbicacion(accion.dto, conversacion.id),
              accion.claveIdempotencia,
              this.origenPedidoWhatsapp(conversacion),
            );
            codigoFinal = pedidoCreado.codigo;
            // La campana del pedido nuevo la crea PedidosService.crear (igual para carta, mozo y WhatsApp)
          }
        } catch (err: any) {
          // Combo rechazado al confirmar (se agotó una parte): se eligen sus partes de nuevo con lo que hay hoy
          if (accion.carrito && (CODIGOS_COMBO_RECHAZADO.includes(String(err?.response?.codigo)) || err?.response?.codigo === 'STOCK_INSUFICIENTE' || err?.response?.codigo === 'OFERTA_NO_APLICA_CANAL')) {
            const vuelta = carritoTrasComboRechazado(accion.carrito, err.response, categoriasCarta, ofertas, textosPersonalizados);
            if (vuelta) {
              await this.volverAlComboRechazado(conversacion.id, vuelta, destinoEnvio, entradaRaw);
              continue;
            }
            if (err.response.codigo !== 'STOCK_INSUFICIENTE') {
              await this.volverAlCarritoSinStock(conversacion.id, accion.carrito, err.response.mensaje ?? 'Ese combo ya no está disponible', destinoEnvio, entradaRaw);
              continue;
            }
          }
          // Sin stock de un producto que controla stock: se vuelve al carrito, en un solo mensaje y sin escalar
          if (err?.response?.codigo === 'STOCK_INSUFICIENTE' && accion.carrito) {
            await this.volverAlCarritoSinStock(conversacion.id, accion.carrito, err.response.mensaje, destinoEnvio, entradaRaw);
            continue;
          }
          // Sabor agotado: se elige otro sabor de ese producto (lista); si ya no queda ninguno, vuelve al carrito
          if (err?.response?.codigo === 'SABOR_AGOTADO' && accion.carrito) {
            const volvio = await this.volverAlSaborAgotado(conversacion.id, accion.carrito, err.response, categoriasCarta, destinoEnvio, entradaRaw);
            if (!volvio) {
              await this.volverAlCarritoSinStock(
                conversacion.id,
                accion.carrito,
                `Ya no quedan ${err.response.saborNombre ?? 'ese sabor'}`,
                destinoEnvio,
                entradaRaw,
              );
            }
            continue;
          }
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

        // Una línea con la carta virtual al confirmar (sin repetirla en cada mensaje)
        const textoConfirmacion =
          TEXTOS_BOT.pedidoConfirmadoExito({
            codigo: codigoFinal,
            tiempoMin: accion.tiempoEstimadoMin,
            tiempoMax: accion.tiempoEstimadoMax,
            esPagoDigital: accion.esPagoDigital,
            capturas: ((accion.dto?.pago?.plan ?? []) as Array<{ medio: string; monto: number }>).filter((f) =>
              ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(f.medio),
            ),
            datosPago: accion.datosPagoTexto,
          }) + `\n\n${TEXTOS_SOLO_MENUS.lineaCartaConfirmacion(cartaUrlPublica)}`;

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

          // Notificación campana para Caja y Salón (texto compartido con la carta web)
          const { titulo: tituloNotif, mensaje: mensajeNotif } = textosNotificacionSolicitud({
            personas: accion.personas,
            fechaHora,
            fechaTexto: accion.fechaTexto,
            hora: accion.hora,
            nombre: accion.nombre,
            telefono: accion.telefono,
            nota: accion.nota,
          });

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

            if (!esDerivacion) {
              const { productoConcreto, productosMultiples } = this.identificarProductosConsulta(
                accion.pregunta,
                textoRespuesta,
                contexto.categoriasCarta || [],
                resIa,
              );

              if (productoConcreto) {
                const validacion = validarYCorregirPreciosIa(
                  textoRespuesta,
                  productoConcreto,
                  contexto.cartaUrlPublica,
                );
                textoRespuesta = validacion.texto;

                const oferta = buscarOfertaParaProducto(
                  productoConcreto,
                  contexto.ofertas || [],
                  contexto.categoriasCarta || [],
                );

                const yaEnPedido = Boolean(
                  flujoPrevio?.pedido &&
                  (flujoPrevio.pedido as any).productoSeleccionadoId === String(productoConcreto.id),
                );

                const cierre = generarCierreComercial({
                  producto: productoConcreto,
                  oferta,
                  funcionesActivas: contexto.funcionesActivas,
                  indiceVariante: Number(conversacion.id || 0),
                  yaEnPedido,
                });

                if (!yaEnPedido) {
                  textoRespuesta = adjuntarCierreComercial(textoRespuesta, cierre);
                  botonesEnvio = cierre.botones;
                }
              } else if (productosMultiples && productosMultiples.length > 1) {
                const cierre = generarCierreComercial({
                  productosRecomendados: productosMultiples,
                  funcionesActivas: contexto.funcionesActivas,
                  indiceVariante: Number(conversacion.id || 0),
                });
                textoRespuesta = limpiarFrasesPasivasIa(textoRespuesta);
                botonesEnvio = cierre.botones;
              } else {
                textoRespuesta = limpiarFrasesPasivasIa(textoRespuesta);
                if (resIa.quierePedir) {
                  botonesEnvio = BOTONES_IA_CON_PEDIDO;
                }
              }
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
              urgente: Boolean(conversacion.urgente),
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

    // Nunca silencio mudo: si la máquina no produjo ninguna acción, queda el evento con su motivo
    if (resultado.acciones.length === 0) {
      await this.registrarSilencio(conversacion.id, `Chat en manos de una persona (estado ${flujoEntrada.estado}); el bot esperó.`);
    }

    // 11. Notificar por WebSocket a la consola de Mensajes
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: conversacion.id.toString() });

    return true;
  }
}
