import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { flujoLiberadoParaBot } from '../conversacion/flujo-liberado.util';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { adquirirCandado, liberarCandado } from '../../../comun/redis/candado.util';
import { AvisosInternosService } from './avisos-internos.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
  BotonAccion,
} from '../puerto/whatsapp-mensajeria.puerto';
import { BOTONES_AVISO_PEDIDO } from './avisos-internos.textos';
import { normalizarTelefono } from '../utilidades/enmascarar.util';
import { consultarEstadoAgente, leerParametroNumerico } from '../../impresion/estado-impresion';

export interface UmbralesAlertasEspera {
  alertaVoucherMin1: number;
  alertaVoucherMin2: number;
  esperaClienteAvisoMin: number;
  chatTomadoLiberarMin: number;
  alertaPedidoSinConfirmarMin: number;
}

export const BOTONES_ESPERA_CLIENTE: BotonAccion[] = [
  { id: 'btn_esp_carta', titulo: 'Ver la carta' },
  { id: 'btn_esp_esperar', titulo: 'Seguir esperando' },
  { id: 'btn_esp_persona', titulo: 'Hablar con persona' },
];

export const TEXTO_ESPERA_CLIENTE =
  'Seguimos revisando tu pago, ya avisamos de nuevo a Caja. Mientras tanto puedes ver la carta o escribir *asesor*.';

@Injectable()
export class AlertasEsperaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertasEsperaService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervaloMs = 20000; // 20 segundos
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly avisosInternosService: AvisosInternosService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  onModuleInit() {
    this.iniciar();
  }

  onModuleDestroy() {
    this.detener();
  }

  iniciar() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.ejecutarCiclo().catch((err) => {
        this.logger.error(`Error en ciclo de alertas de espera: ${err.message}`, err.stack);
      });
    }, this.intervaloMs);
    this.logger.log('Servicio de alertas periódicas y manejo de espera iniciado.');
  }

  detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Carga los parámetros operativos configurables desde la base de datos (tabla parametro).
   * Se evalúan en cada ciclo conforme a la sección 4 del contrato.
   */
  async obtenerUmbrales(): Promise<UmbralesAlertasEspera> {
    const claves = [
      'alerta_voucher_min_1',
      'alerta_voucher_min_2',
      'espera_cliente_aviso_min',
      'chat_tomado_liberar_min',
      'alerta_pedido_sin_confirmar_min',
    ];

    try {
      const parametrosDb = await this.prisma.parametro.findMany({
        where: { clave: { in: claves } },
      });

      const mapa = new Map<string, number>();
      for (const p of parametrosDb) {
        const val = Number(p.valor);
        if (!isNaN(val) && val > 0) {
          mapa.set(p.clave, val);
        }
      }

      return {
        alertaVoucherMin1: mapa.get('alerta_voucher_min_1') ?? 5,
        alertaVoucherMin2: mapa.get('alerta_voucher_min_2') ?? 15,
        esperaClienteAvisoMin: mapa.get('espera_cliente_aviso_min') ?? 10,
        chatTomadoLiberarMin: mapa.get('chat_tomado_liberar_min') ?? 10,
        alertaPedidoSinConfirmarMin: mapa.get('alerta_pedido_sin_confirmar_min') ?? 5,
      };
    } catch (err: any) {
      this.logger.warn(`Error al leer umbrales de configuración: ${err.message}. Usando valores por defecto.`);
      return {
        alertaVoucherMin1: 5,
        alertaVoucherMin2: 15,
        esperaClienteAvisoMin: 10,
        chatTomadoLiberarMin: 10,
        alertaPedidoSinConfirmarMin: 5,
      };
    }
  }

  /**
   * Adquiere una clave de idempotencia atómica en Redis para evitar repetir alertas por umbral.
   */
  private async adquirirIdempotencia(clave: string, ttlSegundos = 86400): Promise<boolean> {
    try {
      const redis = this.redisService.obtenerCliente();
      if (redis && typeof redis.set === 'function') {
        const res = await redis.set(clave, '1', 'EX', ttlSegundos, 'NX');
        return res === 'OK';
      }
    } catch (err: any) {
      this.logger.warn(`Fallo de Redis para idempotencia de alertas (${clave}): ${err.message}`);
    }
    return true;
  }

  /**
   * Ejecuta el ciclo completo de alertas y manejo de espera con candado distribuido Redis.
   */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<{
    alertasVoucherEnviadas: number;
    avisosEsperaClienteEnviados: number;
    chatsLiberados: number;
    alertasPersonaEnviadas: number;
    alertasCajaEnviadas: number;
    alertasStockEnviadas: number;
    alertasImpresoraEnviadas: number;
    bloqueadoPorOtraInstancia?: boolean;
  }> {
    if (this.ejecutando) {
      return {
        alertasVoucherEnviadas: 0,
        avisosEsperaClienteEnviados: 0,
        chatsLiberados: 0,
        alertasPersonaEnviadas: 0,
        alertasCajaEnviadas: 0,
        alertasStockEnviadas: 0,
        alertasImpresoraEnviadas: 0,
      };
    }

    this.ejecutando = true;
    const lockKey = 'lock:chatbot:alertas-espera';
    let lockToken = '';
    const redis = this.redisService ? this.redisService.obtenerCliente() : null;

    let alertasVoucherEnviadas = 0;
    let avisosEsperaClienteEnviados = 0;
    let chatsLiberados = 0;
    let alertasPersonaEnviadas = 0;
    let alertasCajaEnviadas = 0;
    let alertasStockEnviadas = 0;
    let alertasImpresoraEnviadas = 0;

    try {
      const candado = await adquirirCandado(redis, lockKey, 25000);
      if (!candado.adquirido) {
        return {
          alertasVoucherEnviadas: 0,
          avisosEsperaClienteEnviados: 0,
          chatsLiberados: 0,
          alertasPersonaEnviadas: 0,
          alertasCajaEnviadas: 0,
          alertasStockEnviadas: 0,
          alertasImpresoraEnviadas: 0,
          bloqueadoPorOtraInstancia: true,
        };
      }
      lockToken = candado.token;

      const umbrales = await this.obtenerUmbrales();

      // =========================================================================
      // 1) SECCIÓN 2.a & 3: Conversaciones en VALIDAR_PAGO
      // - Alerta 1 a los 5 min (alerta_voucher_min_1)
      // - Alerta 2 a los 15 min (alerta_voucher_min_2) -> chat marcado como urgente
      // - Mensaje único de espera al cliente a los 10 min (espera_cliente_aviso_min)
      // =========================================================================
      const conversacionesVoucher = await this.prisma.conversacion.findMany({
        where: { estado: 'VALIDAR_PAGO' },
        include: {
          mensajes: {
            where: { tipo: 'IMAGEN', direccion: 'ENTRA' },
            orderBy: { en: 'desc' },
            take: 1,
          },
        },
      });

      for (const conv of conversacionesVoucher) {
        const flujo = (conv.flujo as any) || {};
        const pago = flujo.pago || {};
        const capturasEnviadas = pago.capturasEnviadas || 1;
        const timestampCaptura =
          pago.timestampUltimoVoucher ||
          (conv.mensajes?.[0]?.en ? new Date(conv.mensajes[0].en).getTime() : new Date(conv.ultima_actividad).getTime());

        const minutosEspera = Math.floor((ahora.getTime() - timestampCaptura) / (60 * 1000));
        const nombreCliente = conv.nombre_contacto || 'Cliente';
        const codigoPedido = pago.pedidoCodigo ? ` (${pago.pedidoCodigo})` : '';
        const botonesComanda = pago.pedidoId ? BOTONES_AVISO_PEDIDO(pago.pedidoId) : undefined;

        // a) Alerta a los 5 min (Umbral 1)
        if (minutosEspera >= umbrales.alertaVoucherMin1) {
          const claveIdemp1 = `idemp:alerta:voucher:5m:${conv.id}:${capturasEnviadas}`;
          const esPrimero = await this.adquirirIdempotencia(claveIdemp1);
          if (esPrimero) {
            await this.avisosInternosService.enviarAvisoAdmin(
              `Voucher sin revisar (${umbrales.alertaVoucherMin1} min)`,
              `El comprobante de pago de ${nombreCliente}${codigoPedido} lleva ${minutosEspera} min esperando revisión en Caja.`,
              '/admin/mensajes',
              botonesComanda,
              claveIdemp1,
            );
            alertasVoucherEnviadas++;
          }
        }

        // b) Mensaje único al cliente a los 10 min (Manejo de la espera del cliente)
        if (minutosEspera >= umbrales.esperaClienteAvisoMin) {
          const claveIdempEsperaCliente = `idemp:espera:cliente:${conv.id}:${capturasEnviadas}`;
          const esPrimero = await this.adquirirIdempotencia(claveIdempEsperaCliente);
          if (esPrimero) {
            const telCliente = normalizarTelefono(conv.telefono);
            if (telCliente) {
              await this.mensajeria
                .enviarBotones(telCliente, TEXTO_ESPERA_CLIENTE, BOTONES_ESPERA_CLIENTE, {
                  conversacionId: conv.id,
                })
                .catch(async () => {
                  // Fallback a texto libre si los botones interactivos no son soportados
                  return this.mensajeria.enviarTexto(
                    telCliente,
                    `${TEXTO_ESPERA_CLIENTE}\n\n1. Ver la carta\n2. Seguir esperando\n3. Hablar con persona`,
                    { conversacionId: conv.id },
                  );
                });

              // Registrar mensaje en mensaje_chat para auditoría y visualización en el panel
              await this.prisma.mensajeChat.create({
                data: {
                  conversacion_id: conv.id,
                  direccion: 'SALE',
                  autor: 'BOT',
                  tipo: 'BOTON',
                  contenido: {
                    texto: TEXTO_ESPERA_CLIENTE,
                    botones: BOTONES_ESPERA_CLIENTE,
                  } as any,
                },
              }).catch(() => {});

              avisosEsperaClienteEnviados++;
            }
          }
        }

        // c) Alerta a los 15 min (Umbral 2: marcar urgente y avisar)
        if (minutosEspera >= umbrales.alertaVoucherMin2) {
          const claveIdemp2 = `idemp:alerta:voucher:15m:${conv.id}:${capturasEnviadas}`;
          const esPrimero = await this.adquirirIdempotencia(claveIdemp2);
          if (esPrimero) {
            // Marcar conversación como urgente en BD
            await this.prisma.conversacion.update({
              where: { id: conv.id },
              data: { urgente: true },
            }).catch(() => {});

            // Notificar por WebSocket al panel de Mensajes
            this.eventosGateway?.emitirAdmin('mensajes:actualizar', {
              id: conv.id.toString(),
              urgente: true,
            });

            await this.avisosInternosService.enviarAvisoAdmin(
              `URGENTE: Voucher sin revisar (${umbrales.alertaVoucherMin2} min)`,
              `El comprobante de pago de ${nombreCliente}${codigoPedido} no ha sido revisado en ${minutosEspera} min. Chat marcado como URGENTE.`,
              '/admin/mensajes',
              botonesComanda,
              claveIdemp2,
            );
            alertasVoucherEnviadas++;
          }
        }
      }

      // =========================================================================
      // 2) SECCIÓN 3: Chat tomado y abandonado
      // - Si una persona toma un chat y pasan 10 min sin que envíe mensaje al cliente,
      //   el chat se libera solo al bot y se avisa por campana a quien lo tenía.
      // - EXCEPCIÓN ESTRICTA: conversacion con voucher sin revisar (VALIDAR_PAGO)
      //   NUNCA se libera al bot: sigue con Caja y con las alertas.
      // =========================================================================
      const chatsTomados = await this.prisma.conversacion.findMany({
        where: {
          tomado_por: { not: null },
        },
        include: {
          tomadoPorUsuario: true,
          mensajes: {
            where: { autor: 'PERSONA', direccion: 'SALE' },
            orderBy: { en: 'desc' },
            take: 1,
          },
        },
      });

      for (const chat of chatsTomados) {
        // EXCEPCIÓN: VALIDAR_PAGO NUNCA se libera al bot
        if (chat.estado === 'VALIDAR_PAGO') {
          continue;
        }

        const ultimoEnvioPersona = chat.mensajes?.[0]?.en
          ? new Date(chat.mensajes[0].en).getTime()
          : chat.tomado_en
            ? new Date(chat.tomado_en).getTime()
            : new Date(chat.ultima_actividad).getTime();

        const minutosInactivo = Math.floor((ahora.getTime() - ultimoEnvioPersona) / (60 * 1000));

        if (minutosInactivo >= umbrales.chatTomadoLiberarMin) {
          const partyDestino = chat.tomadoPorUsuario?.party_id ?? undefined;

          // Liberar el chat al bot
          await this.prisma.conversacion.update({
            where: { id: chat.id },
            data: {
              duenio: 'BOT',
              tomado_por: null,
              tomado_en: null,
              urgente: false,
              ultima_actividad: ahora,
              flujo: flujoLiberadoParaBot((chat as any).flujo) as any,
            },
          });

          // Avisar por campana a la persona que tenía el chat tomado
          await this.avisosInternosService.emitirAvisoCampana(
            'Chat liberado por inactividad',
            `El chat con ${chat.nombre_contacto || chat.telefono} fue liberado al bot tras superar ${minutosInactivo} min sin respuesta.`,
            '/admin/mensajes',
            partyDestino,
          );

          // Emitir actualización por WebSocket
          this.eventosGateway?.emitirAdmin('mensajes:actualizar', {
            id: chat.id.toString(),
            duenio: 'BOT',
            tomado_por: null,
            urgente: false,
          });

          chatsLiberados++;
          this.logger.log(`Chat ${chat.id} liberado al bot por inactividad (${minutosInactivo} min).`);
        }
      }

      // =========================================================================
      // 3) SECCIÓN 2.b: Chat esperando a una persona
      // - Cliente pidió asesor o conversación en manos de PERSONA sin respuesta
      //   humana por más de 5 minutos.
      // =========================================================================
      const chatsEsperandoPersona = await this.prisma.conversacion.findMany({
        where: {
          duenio: 'PERSONA',
          estado: { notIn: ['ATENDIDA', 'VALIDAR_PAGO'] },
        },
        include: {
          mensajes: {
            orderBy: { en: 'desc' },
            take: 1,
          },
        },
      });

      for (const chat of chatsEsperandoPersona) {
        const ultimoMsg = chat.mensajes?.[0];
        // Solo aplica si el último mensaje fue entrante (del cliente)
        if (ultimoMsg && ultimoMsg.direccion === 'ENTRA') {
          const minutosSinRespuesta = Math.floor(
            (ahora.getTime() - new Date(ultimoMsg.en).getTime()) / (60 * 1000),
          );

          if (minutosSinRespuesta >= 5) {
            const claveIdempPersona = `idemp:alerta:chat:persona:${chat.id}:${new Date(ultimoMsg.en).getTime()}`;
            const esPrimero = await this.adquirirIdempotencia(claveIdempPersona);
            if (esPrimero) {
              const nombreCli = chat.nombre_contacto || chat.telefono;
              await this.avisosInternosService.enviarAvisoAdmin(
                `Chat esperando asesor (${minutosSinRespuesta} min)`,
                `El cliente ${nombreCli} lleva ${minutosSinRespuesta} min esperando respuesta de un asesor.`,
                '/admin/mensajes',
                undefined,
                claveIdempPersona,
              );
              alertasPersonaEnviadas++;
            }
          }
        }
      }

      // =========================================================================
      // 4) SECCIÓN 2.c: Pedido nuevo sin confirmar en Caja por más de 5 minutos
      // =========================================================================
      const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
      const pedidosSinConfirmar = await this.prisma.pedido.findMany({
        where: {
          estado: 'COLA',
          pago_estado: 'PENDIENTE',
          creado_en: { gte: hace24h },
        },
      });

      for (const ped of pedidosSinConfirmar) {
        const minutosCreado = Math.floor((ahora.getTime() - new Date(ped.creado_en).getTime()) / (60 * 1000));
        if (minutosCreado >= umbrales.alertaPedidoSinConfirmarMin) {
          const claveIdempPed = `idemp:alerta:pedido:caja:${ped.id}`;
          const esPrimero = await this.adquirirIdempotencia(claveIdempPed);
          if (esPrimero) {
            await this.avisosInternosService.enviarAvisoAdmin(
              `Pedido ${ped.codigo} sin confirmar (${minutosCreado} min)`,
              `El pedido ${ped.codigo} (${ped.modalidad} - ${ped.cliente_nombre || 'Cliente'}) lleva ${minutosCreado} min en Caja sin confirmar.`,
              '/admin/caja',
              BOTONES_AVISO_PEDIDO(ped.id),
              claveIdempPed,
            );
            alertasCajaEnviadas++;
          }
        }
      }

      // =========================================================================
      // 5) SECCIÓN 2.d: Stock bajo (una vez al día por insumo) y falla de impresora
      // =========================================================================
      // a) Stock bajo diario
      const fechaHoy = ahora.toISOString().slice(0, 10);
      const insumos = await this.prisma.insumo.findMany({
        where: { activo: true },
        include: { stocks: true },
      });

      for (const insumo of insumos) {
        const stockTotal = insumo.stocks.reduce((acc, s) => acc + Number(s.cantidad), 0);
        const minimo = Number(insumo.minimo);
        if (stockTotal <= minimo) {
          const claveIdempStock = `idemp:alerta:stock:${insumo.id}:${fechaHoy}`;
          const esPrimero = await this.adquirirIdempotencia(claveIdempStock);
          if (esPrimero) {
            const estadoTexto = stockTotal <= 0 ? 'AGOTADO' : 'POR_PEDIR';
            await this.avisosInternosService.enviarAvisoAdmin(
              `Alerta de Stock: ${insumo.nombre} (${estadoTexto})`,
              `El insumo ${insumo.nombre} tiene stock ${stockTotal.toFixed(2)} ${insumo.unidad_almacen} (Mínimo: ${minimo.toFixed(2)}).`,
              '/admin/stock',
              undefined,
              claveIdempStock,
            );
            alertasStockEnviadas++;
          }
        }
      }

      // b) Falla de impresora
      const hace2Horas = new Date(ahora.getTime() - 2 * 60 * 60 * 1000);
      const printJobsFallidos = await this.prisma.printJob.findMany({
        where: {
          estado: 'FALLIDO',
          creado_en: { gte: hace2Horas },
        },
      });

      for (const job of printJobsFallidos) {
        const claveIdempImp = `idemp:alerta:impresora:${job.id}`;
        const esPrimero = await this.adquirirIdempotencia(claveIdempImp);
        if (esPrimero) {
          await this.avisosInternosService.enviarAvisoAdmin(
            `Falla de Impresora: Trabajo #${job.id}`,
            `El trabajo de impresión ${job.tipo} #${job.id} falló: ${job.error || 'Error reportado por el agente local'}.`,
            '/admin/configuracion',
            undefined,
            claveIdempImp,
          );
          alertasImpresoraEnviadas++;
        }
      }

      // 6) SECCIÓN 2.e: etiquetas en cola sin agente de impresión (una alerta por tanda)
      alertasImpresoraEnviadas += await this.avisarEtiquetasSinAgente(ahora).catch((err: any) => {
        this.logger.warn(`Error en aviso de etiquetas sin agente: ${err.message}`);
        return 0;
      });

      return {
        alertasVoucherEnviadas,
        avisosEsperaClienteEnviados,
        chatsLiberados,
        alertasPersonaEnviadas,
        alertasCajaEnviadas,
        alertasStockEnviadas,
        alertasImpresoraEnviadas,
        bloqueadoPorOtraInstancia: false,
      };
    } finally {
      if (lockToken) {
        await liberarCandado(redis, lockKey, lockToken).catch(() => {});
      }
      this.ejecutando = false;
    }
  }

  /**
   * Etiquetas en cola más de impresion_alerta_min minutos sin agente o sin impresora lista:
   * un solo aviso por WhatsApp (y campana) por tanda. La tanda se identifica por el trabajo
   * más antiguo en cola: cuando se imprime o vence, la siguiente tanda vuelve a avisar.
   */
  private async avisarEtiquetasSinAgente(ahora: Date): Promise<number> {
    const minutos = await leerParametroNumerico(this.prisma, 'impresion_alerta_min', 5);
    const corte = new Date(ahora.getTime() - minutos * 60 * 1000);
    const masViejo = await this.prisma.printJob.findFirst({
      where: { estado: 'PENDIENTE', en: { lte: corte } },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!masViejo) return 0;

    const estado = await consultarEstadoAgente(this.prisma, ahora.getTime());
    if (estado.sinProblema) return 0;

    const primero = await this.adquirirIdempotencia(
      `idemp:impresion:sin-agente:${masViejo.id}`,
      7 * 86400,
    );
    if (!primero) return 0;

    const pendientes = await this.prisma.printJob.count({ where: { estado: 'PENDIENTE' } });
    const motivo = estado.conectado
      ? 'la impresora de Caja reporta un problema'
      : 'la PC de la etiquetera no está conectada';
    await this.avisosInternosService.enviarAvisoAdmin(
      'Etiquetas sin imprimir',
      `Hay ${pendientes} etiqueta(s) en cola desde hace más de ${minutos} min y ${motivo}. ` +
        'Revisa que la PC de la etiquetera esté encendida, con el programa de impresión abierto y con sesión iniciada.',
      '/admin/caja',
    );
    return 1;
  }
}
