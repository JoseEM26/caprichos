import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { Ventana24hService } from './ventana-24h.service';
import { TareaRecordatorioPagoService } from './tarea-recordatorio-pago.service';
import { AvisosPedidoService, NUMEROS_INTENTO, esParametroActivo } from './avisos-pedido.service';
import { ReprogramacionService, MOTIVO_RETIRO } from './reprogramacion.service';
import { OutboxWhatsappService } from './outbox-whatsapp.service';
import { calcularMontoReprogramacion } from '../../repartos/recargo-reprogramacion';
import { telefonoEnviable } from '../utilidades/enmascarar.util';
import { adquirirCandado, liberarCandado } from '../../../comun/redis/candado.util';

export interface ParametrosChatbot {
  avisoSalidaActivo: boolean;
  avisoLlegadaActivo: boolean;
  avisoEsperaActivo: boolean;
  avisoRecojoActivo: boolean;
  avisoPagoConfirmadoActivo: boolean;
  avisoListoActivo: boolean;
  avisoEntregadoActivo: boolean;
  avisoEncuestaActivo: boolean;
  repartoInsistenciaMin: number;
  repartoEsperaMaxMin: number;
  /** Minutos que espera la pregunta de reprogramar antes de cancelar por falta de respuesta. */
  reprogRespuestaMin: number;
  /** Reprogramaciones máximas por pedido; al llegar al tope no se vuelve a preguntar. */
  reprogMaxIntentos: number;
  encuestaEsperaMin: number;
  encuestaPuntajeQueja: number;
  tiempoPrometidoMin: number;
}


/** Ventana de pedidos que el planificador revisa; más viejos ya no son parte de un reparto en curso. */
const VENTANA_REVISION_MS = 24 * 60 * 60 * 1000;
/** El recordatorio de voucher solo tiene sentido poco después del aviso: pedidos más viejos ya los atiende una persona. */
const VENTANA_RECORDATORIO_VOUCHER_MS = 60 * 60 * 1000;

export interface ResumenCicloChatbot {
  bloqueadoPorOtraInstancia: boolean;
  avisosInsistencia: number;
  avisosEspera: number;
  retiros: number;
  avisosAceptado: number;
  avisosRecojo: number;
  avisosEncuesta: number;
  reprogVencidas?: number;
}

const resumenVacio = (bloqueado: boolean): ResumenCicloChatbot => ({
  bloqueadoPorOtraInstancia: bloqueado,
  avisosInsistencia: 0,
  avisosEspera: 0,
  retiros: 0,
  avisosAceptado: 0,
  avisosRecojo: 0,
  avisosEncuesta: 0,
});

/**
 * Planificador de avisos por tiempo. Corre cada 30 s con candado en Redis.
 * - Por tiempo (aquí): insistencia en puerta, espera agotada, retiro de la movilidad y aceptación por cobro.
 * - Por evento (los avisan los endpoints de reparto y cocina con AvisosPedidoService): salida, llegada,
 *   listo y entregado. Cada aviso es idempotente por pedido y etapa.
 */
@Injectable()
export class ChatbotPlanificadorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatbotPlanificadorService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervaloMs = 30000; // 30 segundos
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly ventana24hService: Ventana24hService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional() private readonly tareaRecordatorioPago?: TareaRecordatorioPagoService,
    @Optional() private readonly avisos?: AvisosPedidoService,
    @Optional() private readonly reprogramacion?: ReprogramacionService,
    @Optional() private readonly outbox?: OutboxWhatsappService,
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
        this.logger.error(`Error en ciclo de planificador de chatbot: ${err.message}`, err.stack);
      });
    }, this.intervaloMs);
    this.logger.log('Planificador de avisos automáticos de Chatbot iniciado (cada 30s).');
  }

  detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Carga los parámetros operativos y banderas de activación desde la tabla parametro.
   */
  async obtenerParametros(): Promise<ParametrosChatbot> {
    const claves = [
      'whatsapp_aviso_salida_activo',
      'whatsapp_aviso_llegada_activo',
      'whatsapp_aviso_espera_activo',
      'whatsapp_aviso_recojo_activo',
      'whatsapp_aviso_pago_confirmado_activo',
      'whatsapp_aviso_listo_activo',
      'whatsapp_aviso_entregado_activo',
      'whatsapp_aviso_encuesta_activo',
      'reparto_insistencia_min',
      'reparto_espera_max_min',
      'reprog_respuesta_min',
      'reprog_max_intentos',
      'encuesta_espera_min',
      'encuesta_puntaje_queja',
      'tiempo_prometido_min',
    ];

    const parametrosDb = await this.prisma.parametro.findMany({
      where: { clave: { in: claves } },
    });

    const mapa = new Map<string, any>();
    for (const p of parametrosDb) {
      mapa.set(p.clave, p.valor);
    }

    const esActivo = (v: any) => v === true || String(v).toLowerCase() === 'si';

    return {
      avisoSalidaActivo: esActivo(mapa.get('whatsapp_aviso_salida_activo')),
      avisoLlegadaActivo: esActivo(mapa.get('whatsapp_aviso_llegada_activo')),
      avisoEsperaActivo: esActivo(mapa.get('whatsapp_aviso_espera_activo')),
      avisoRecojoActivo: esActivo(mapa.get('whatsapp_aviso_recojo_activo')),
      avisoPagoConfirmadoActivo: esActivo(mapa.get('whatsapp_aviso_pago_confirmado_activo')),
      avisoListoActivo: esActivo(mapa.get('whatsapp_aviso_listo_activo')),
      avisoEntregadoActivo: esActivo(mapa.get('whatsapp_aviso_entregado_activo')),
      avisoEncuestaActivo: esActivo(mapa.get('whatsapp_aviso_encuesta_activo')),
      repartoInsistenciaMin: Number(mapa.get('reparto_insistencia_min') ?? 3),
      repartoEsperaMaxMin: Number(mapa.get('reparto_espera_max_min') ?? 10),
      reprogRespuestaMin: Number(mapa.get('reprog_respuesta_min') ?? 30),
      reprogMaxIntentos: Number(mapa.get('reprog_max_intentos') ?? 1),
      encuestaEsperaMin: Number(mapa.get('encuesta_espera_min') ?? 30),
      encuestaPuntajeQueja: Number(mapa.get('encuesta_puntaje_queja') ?? 2),
      tiempoPrometidoMin: Number(mapa.get('tiempo_prometido_min') ?? 30),
    };
  }

  /**
   * Ejecuta un ciclo de evaluación de pedidos con bloqueo distribuido en Redis (ioredis).
   */
  async ejecutarCiclo(): Promise<ResumenCicloChatbot> {
    if (this.ejecutando) return resumenVacio(true);

    this.ejecutando = true;
    const lockKey = 'lock:chatbot:planificador';
    let lockAdquirido = false;
    let lockFallback = false;
    let lockToken = '';

    try {
      const redis = this.redisService.obtenerCliente();
      // Bloqueo distribuido seguro con SET NX PX (25s) y liberación solo con token propio
      const candado = await adquirirCandado(redis, lockKey, 25000);
      lockAdquirido = candado.adquirido;
      lockFallback = candado.fallback;
      lockToken = candado.token;

      if (!lockAdquirido) return resumenVacio(true);

      const params = await this.obtenerParametros();
      const ahora = new Date();
      const resumen = resumenVacio(false);

      // Pedidos de carta con pago digital que siguen sin voucher: un recordatorio por pedido
      if (this.avisos) {
        await this.avisarFaltaVoucher(ahora).catch((err) => {
          this.logger.error(`Error en recordatorio de voucher: ${err.message}`, err.stack);
        });
      }

      // Outbox de WhatsApp: envía lo encolado (avisos nuevos y reintentos vencidos) y borra lo enviado y viejo
      if (this.outbox) {
        await this.outbox.procesarLote().catch((err) => {
          this.logger.error(`Error al procesar el outbox de WhatsApp: ${err.message}`, err.stack);
        });
        await this.outbox.limpiar(ahora).catch((err) => {
          this.logger.error(`Error al limpiar el outbox de WhatsApp: ${err.message}`, err.stack);
        });
      }

      // 1. Delivery en puerta (tiempos) y aceptación por cobro
      const pedidosDelivery = await this.prisma.pedido.findMany({
        where: {
          modalidad: 'DELIVERY',
          estado: { notIn: ['ANULADO'] },
          cliente_telefono: { not: null },
          creado_en: { gte: new Date(ahora.getTime() - VENTANA_REVISION_MS) },
        },
      });

      for (const p of pedidosDelivery) {
        try {
        const telefono = telefonoEnviable(p.cliente_telefono);
        if (!telefono) continue;

        // Consentimiento Ley 29733: no enviar si dijo BAJA
        const acepta = await this.ventana24hService.tieneConsentimiento(telefono);
        if (!acepta) continue;

        // ACEPTADO: Caja pasó el pedido a preparación o el cobro quedó PAGADO con el pedido en COLA
        const aceptado =
          p.estado === 'PREPARANDO' || (p.pago_estado === 'PAGADO' && p.estado === 'COLA');
        if (params.avisoPagoConfirmadoActivo && aceptado) {
          const r = await this.avisos?.avisar(p.id, 'ACEPTADO');
          if (r && r.estado !== 'OMITIDO' && r.estado !== 'YA_ENVIADO') resumen.avisosAceptado++;
        }

        // Tiempos de espera en puerta: solo con el pedido EN_CAMINO y el repartidor ya llegó
        const enPuerta = p.estado === 'EN_CAMINO' && p.llego_en != null && p.entregado_en == null && p.repartidor_party_id != null;
        if (!enPuerta || !p.llego_en) continue;

        const minutosEnPuerta = (ahora.getTime() - p.llego_en.getTime()) / 60000;

        // (1) INSISTENCIA: recordatorio al cliente a los reparto_insistencia_min
        if (params.avisoLlegadaActivo && minutosEnPuerta >= params.repartoInsistenciaMin) {
          const r = await this.avisos?.avisar(p.id, 'INSISTENCIA', { minutos: Math.floor(minutosEnPuerta) });
          if (r && r.estado !== 'OMITIDO' && r.estado !== 'YA_ENVIADO') resumen.avisosInsistencia++;
        }

        if (!params.avisoEsperaActivo) continue;

        // (2) ESPERA AGOTADA: aviso de que la movilidad se retirará, con reprogramación y recargo
        if (minutosEnPuerta >= params.repartoEsperaMaxMin) {
          const r = await this.avisos?.avisar(p.id, 'ESPERA_AGOTADA');
          if (r && r.estado !== 'OMITIDO' && r.estado !== 'YA_ENVIADO') {
            resumen.avisosEspera++;
            await this.notificarEquipo(
              'ESPERA_AGOTADA',
              'Espera agotada en entrega de pedido',
              `Repartidor superó los ${params.repartoEsperaMaxMin} min de espera en la puerta para ${p.codigo}. Se avisó al cliente que la movilidad se retirará.`,
            );
          }
        }

        // (3) RETIRO: tras la espera máxima más reparto_insistencia_min de gracia, la movilidad se retira
        //     y el pedido vuelve a LISTO con motivo de falla y recargo de reprogramación.
        if (minutosEnPuerta >= params.repartoEsperaMaxMin + params.repartoInsistenciaMin) {
          // Mismo cálculo que luego cobra el reenvío (se guarda en el incidente y se le dice al cliente)
          const { monto: recargo, modo: recargoModo } = await calcularMontoReprogramacion(this.prisma, p.id);
          const retirado = await this.retirarMovilidad(p.id, p.repartidor_party_id, recargo, ahora);
          if (retirado) {
            resumen.retiros++;
            // Tope de reprogramaciones alcanzado: no se pregunta, el pedido se cancela directo
            const tope = this.reprogramacion
              ? await this.reprogramacion.topeAlcanzado(p.id, params.reprogMaxIntentos)
              : false;
            if (tope) {
              await this.reprogramacion?.cancelar(p.id, 'TOPE');
            } else {
              await this.avisos?.avisar(p.id, 'RETIRO', { recargo, recargoModo });
            }
            await this.notificarEquipo(
              'RETIRO_MOVILIDAD',
              'Movilidad retirada por espera agotada',
              tope
                ? `La movilidad se retiró de ${p.codigo} y se alcanzó el límite de reprogramaciones: el pedido se canceló.`
                : `La movilidad se retiró de ${p.codigo} tras la espera máxima. Se preguntó al cliente si reprograma; si no responde en ${params.reprogRespuestaMin} min el pedido se cancela.`,
              p.id,
            );
          }
        }
        } catch (err: any) {
          // Un pedido con error no debe frenar el ciclo de los demás
          this.logger.error(`Error en avisos del pedido ${p.codigo}: ${err?.message}`, err?.stack);
        }
      }

      // 1b. Pregunta de reprogramar sin respuesta a tiempo: cancelado por falta de respuesta
      if (this.reprogramacion) {
        try {
          resumen.reprogVencidas = await this.reprogramacion.vencerSinRespuesta(params.reprogRespuestaMin, ahora);
        } catch (err: any) {
          this.logger.error(`Error al vencer reprogramaciones: ${err?.message}`, err?.stack);
        }
      }

      // 2. Pedido para llevar / recojo listo en barra
      if (params.avisoRecojoActivo) {
        const pedidosRecojo = await this.prisma.pedido.findMany({
          where: {
            modalidad: { in: ['RECOJO', 'LLEVAR'] },
            estado: 'LISTO',
            listo_en: { gte: new Date(ahora.getTime() - VENTANA_REVISION_MS) },
            cliente_telefono: { not: null },
          },
          select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true },
        });

        for (const p of pedidosRecojo) {
          const telefono = telefonoEnviable(p.cliente_telefono);
          if (!telefono) continue;

          const yaEnviado = await this.prisma.whatsappMensaje.findFirst({
            where: {
              pedido_id: p.id,
              direccion: 'SALIENTE',
              OR: [
                { plantilla: 'caprichos_pedido_listo_recojo' },
                { tipo: 'TEXTO' },
              ],
            },
          });

          if (!yaEnviado) {
            const acepta = await this.ventana24hService.tieneConsentimiento(telefono);
            if (!acepta) continue;

            const nombre = p.cliente_nombre || 'Cliente';
            await this.outbox!.encolar({
              telefono,
              tipo: 'TEXTO',
              clave: `recojo-${p.id}`,
              origen: 'RECOJO',
              pedidoId: p.id,
              carga: {
                textoLibre: `¡Hola ${nombre}! 🥳 Tu pedido ${p.codigo} ya está listo para recoger en nuestro local. ¡Te esperamos con gusto! 😊`,
                plantillaClave: 'PEDIDO_LISTO_RECOJO',
                variablesPlantilla: [nombre, p.codigo],
                autor: 'BOT',
                nombre,
                pedidoCodigo: p.codigo,
                etapa: 'RECOJO',
              },
            });
            resumen.avisosRecojo++;
          }
        }
      }

      // 3. Encuesta posventa tras X minutos de la entrega, para todo pedido con teléfono (carta, bot, mozo y caja).
      //    Delivery y recojo: entregado_en (cocina o reparto). Mesa: entregado en mesa o el cobro.
      //    Para llevar/recoger que quedó LISTO y se cobró sin pasar por cocina (no fija entregado_en): el cobro vigente.
      if (params.avisoEncuestaActivo) {
        const limiteEntregado = new Date(ahora.getTime() - params.encuestaEsperaMin * 60000);
        // Solo entregas recientes: sin ventana, activar la encuesta enviaría a todo el historial
        const desde = new Date(ahora.getTime() - VENTANA_REVISION_MS);
        const cobroVigenteEnVentana = { some: { anulado_en: null, en: { gte: desde, lte: limiteEntregado } } };
        const pedidosParaEncuesta = await this.prisma.pedido.findMany({
          where: {
            estado: { notIn: ['ANULADO'] },
            cliente_telefono: { not: null },
            encuestaPosventa: null, // Que no tenga encuesta enviada
            OR: [
              { entregado_en: { gte: desde, lte: limiteEntregado } },
              { modalidad: 'MESA', entregado_mesa_en: { gte: desde, lte: limiteEntregado } },
              { modalidad: 'MESA', cobros: cobroVigenteEnVentana },
              { modalidad: { notIn: ['DELIVERY', 'MESA'] }, estado: { in: ['LISTO', 'ENTREGADO'] }, cobros: cobroVigenteEnVentana },
            ],
          },
          select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true },
        });

        for (const p of pedidosParaEncuesta) {
          // Sin teléfono real (vacío o el relleno 999999999) no hay a quién encuestar: se omite sin error
          const telefono = telefonoEnviable(p.cliente_telefono);
          if (!telefono) continue;

          const acepta = await this.ventana24hService.tieneConsentimiento(telefono);
          if (!acepta) continue;

          const nombre = p.cliente_nombre || 'Cliente';

          // Encuesta ENVIADA y mensaje encolado en una sola transacción: si se cae, no queda una a medias
          await this.prisma.$transaction(async (tx) => {
            await tx.encuestaPosventa.create({
              data: {
                pedido_id: p.id,
                estado: 'ENVIADA',
                enviada_en: ahora,
              },
            });
            // Botones si la ventana está abierta, o plantilla si está cerrada (se decide al enviar)
            await this.outbox!.encolar(
              {
                telefono,
                tipo: 'TEXTO',
                clave: `encuesta-${p.id}`,
                origen: 'ENCUESTA',
                pedidoId: p.id,
                carga: {
                  textoLibre: `Hola ${nombre}, gracias por tu compra en Caprichos (pedido ${p.codigo}). ¿Como calificarias tu atencion del 1 al 5?`,
                  plantillaClave: 'ENCUESTA_POSVENTA',
                  variablesPlantilla: [nombre, p.codigo],
                  botones: [
                    { id: 'encuesta:1', titulo: '1 Malo' },
                    { id: 'encuesta:3', titulo: '3 Regular' },
                    { id: 'encuesta:5', titulo: '5 Excelente' },
                  ],
                  autor: 'BOT',
                  nombre,
                  pedidoCodigo: p.codigo,
                  etapa: 'ENCUESTA',
                },
              },
              tx,
            );
          });

          resumen.avisosEncuesta++;
        }
      }

      if (this.tareaRecordatorioPago) {
        await this.tareaRecordatorioPago.ejecutarCiclo(ahora).catch((err) => {
          this.logger.error(`Error en ciclo de tareaRecordatorioPago: ${err.message}`, err.stack);
        });
      }

      // Lo encolado en este ciclo sale ya, sin esperar los 30 s del próximo
      this.outbox?.despertar();

      return resumen;
    } finally {
      this.ejecutando = false;
      if (lockAdquirido && !lockFallback) {
        try {
          const redis = this.redisService.obtenerCliente();
          await liberarCandado(redis, lockKey, lockToken);
        } catch { /* liberar el candado es best-effort; expira solo por TTL */ }
      }
    }
  }

  /**
   * Retira la movilidad de un pedido en puerta: solo si sigue EN_CAMINO con ese repartidor (una sola vez).
   * El pedido vuelve a LISTO sin repartidor con motivo ESPERA_AGOTADA y se registra el incidente con recargo.
   * Se borran los avisos del intento anterior (etapas 1 a 4) para que el nuevo intento vuelva a avisar.
   */
  private async retirarMovilidad(
    pedidoId: bigint,
    repartidorPartyId: bigint | null,
    recargo: number,
    ahora: Date,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const actualizados = await tx.pedido.updateMany({
        where: {
          id: pedidoId,
          estado: 'EN_CAMINO',
          llego_en: { not: null },
          entregado_en: null,
          repartidor_party_id: repartidorPartyId,
        },
        data: {
          estado: 'LISTO',
          repartidor_party_id: null,
          motivo_falla: MOTIVO_RETIRO,
          salio_en: null,
          llego_en: null,
        },
      });
      if (actualizados.count === 0) return false;

      const intentos = await tx.incidenteEntrega.count({ where: { pedido_id: pedidoId } });
      await tx.incidenteEntrega.create({
        data: {
          pedido_id: pedidoId,
          motivo: MOTIVO_RETIRO,
          intento: intentos + 1,
          recargo,
          contactos: [],
          en: ahora,
        },
      });

      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: 'EN_CAMINO',
          estado_nuevo: 'LISTO',
          motivo: 'Retiro por espera agotada',
          por_party_id: repartidorPartyId,
          en: ahora,
        },
      });

      await tx.mensajeReparto.deleteMany({
        where: { pedido_id: pedidoId, numero: { in: NUMEROS_INTENTO } },
      });

      return true;
    }).then((ok) => {
      if (ok) {
        this.eventos?.emitirAdmin('pedido:estado', { id: Number(pedidoId), estado: 'LISTO', motivo_falla: MOTIVO_RETIRO });
        this.eventos?.emitirAdmin('reparto:incidente', { pedidoId: Number(pedidoId), motivo: MOTIVO_RETIRO });
      }
      return ok;
    });
  }

  /**
   * Recordatorio del voucher: a los `voucher_recordatorio_min` minutos del aviso «pedido recibido»,
   * si el pedido digital sigue sin pagar, sin voucher legible, no anulado, y el cliente no escribió
   * nada desde el aviso. Una sola vez por pedido (la fila 14 de mensaje_reparto es la idempotencia).
   */
  async avisarFaltaVoucher(ahora: Date): Promise<number> {
    // Apagado: no se busca nada. Sin este corte cada ciclo revisaría los pedidos de la última hora para nada
    const activo = await this.prisma.parametro.findUnique({ where: { clave: 'whatsapp_aviso_voucher_recordatorio_activo' } });
    if (!esParametroActivo(activo?.valor)) return 0;
    const param = await this.prisma.parametro.findUnique({ where: { clave: 'voucher_recordatorio_min' } });
    const minutos = Number(param?.valor ?? 3) || 3;
    const corte = new Date(ahora.getTime() - minutos * 60 * 1000);

    const avisos = await this.prisma.mensajeReparto.findMany({
      where: { numero: 9, enviado_en: { lte: corte, gte: new Date(ahora.getTime() - VENTANA_RECORDATORIO_VOUCHER_MS) } },
      select: { pedido_id: true, enviado_en: true },
      orderBy: { enviado_en: 'asc' },
      take: 50,
    });

    let enviados = 0;
    for (const aviso of avisos) {
      const yaRecordado = await this.prisma.mensajeReparto.findUnique({
        where: { pedido_id_numero: { pedido_id: aviso.pedido_id, numero: 14 } },
        select: { numero: true },
      });
      if (yaRecordado) continue;

      const pedido = await this.prisma.pedido.findUnique({
        where: { id: aviso.pedido_id },
        select: {
          id: true,
          estado: true,
          pago_estado: true,
          pago_metodo: true,
          pago_preferido: true,
          cliente_telefono: true,
          cobro_mozo_en: true,
        },
      });
      if (!pedido || pedido.estado === 'ANULADO' || pedido.estado === 'ENTREGADO' || pedido.pago_estado !== 'PENDIENTE') continue;
      // Pagado sin captura: el personal ya confirmó con el cliente, no se le recuerda el voucher
      if (pedido.cobro_mozo_en) continue;
      const medio = String(pedido.pago_preferido || pedido.pago_metodo || '').toUpperCase();
      if (!['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(medio)) continue;

      const legible = await this.prisma.voucherPago.findFirst({
        where: { pedido_id: pedido.id, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } },
        select: { id: true },
      });
      if (legible) continue;

      // Si el cliente escribió desde el aviso, la conversación ya tiene su atención: no se recuerda
      const telefono = telefonoEnviable(pedido.cliente_telefono);
      if (!telefono) continue;
      const conversacion = await this.prisma.conversacion.findUnique({ where: { telefono }, select: { id: true } });
      if (conversacion) {
        const escribio = await this.prisma.mensajeChat.findFirst({
          where: { conversacion_id: conversacion.id, direccion: 'ENTRA', en: { gt: aviso.enviado_en } },
          select: { id: true },
        });
        if (escribio) continue;
      }

      const resultado = await this.avisos!.avisar(pedido.id, 'VOUCHER_RECORDATORIO');
      if (resultado.estado === 'ENCOLADO') enviados++;
    }
    return enviados;
  }

  /** Notifica a Caja por la campana interna (y en tiempo real) de un evento de reparto. */
  private async notificarEquipo(tipo: string, titulo: string, mensaje: string, pedidoId?: bigint) {
    const notif = await this.prisma.notificacion.create({
      data: {
        tipo,
        rol_destino: 'CAJERO', // rol real en la tabla rol (no existe 'CAJA')
        titulo,
        mensaje,
        enlace: '/admin/caja',
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo, pedidoId: pedidoId ? Number(pedidoId) : undefined });
  }
}
