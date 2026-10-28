import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { Ventana24hService } from './ventana-24h.service';
import { TareaRecordatorioPagoService } from './tarea-recordatorio-pago.service';
import { AvisosPedidoService, NUMEROS_INTENTO } from './avisos-pedido.service';
import { ReprogramacionService, MOTIVO_RETIRO } from './reprogramacion.service';
import { calcularMontoReprogramacion } from '../../repartos/recargo-reprogramacion';
import { normalizarTelefono } from '../utilidades/enmascarar.util';
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
        const telefono = normalizarTelefono(p.cliente_telefono || '');
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
          const telefono = normalizarTelefono(p.cliente_telefono || '');
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
            await this.ventana24hService.enviarMensajeNegocio(
              telefono,
              {
                textoLibre: `¡Hola ${nombre}! 🥳 Tu pedido ${p.codigo} ya está listo para recoger en nuestro local. ¡Te esperamos con gusto! 😊`,
                plantillaClave: 'PEDIDO_LISTO_RECOJO',
                variablesPlantilla: [nombre, p.codigo],
              },
              { pedidoId: p.id },
            );
            resumen.avisosRecojo++;
          }
        }
      }

      // 3. Encuesta posventa tras X minutos de ENTREGADO
      if (params.avisoEncuestaActivo) {
        const limiteEntregado = new Date(ahora.getTime() - params.encuestaEsperaMin * 60000);
        const pedidosParaEncuesta = await this.prisma.pedido.findMany({
          where: {
            // Solo entregas recientes: sin ventana, activar la encuesta enviaría a todo el historial
            entregado_en: { gte: new Date(ahora.getTime() - VENTANA_REVISION_MS), lte: limiteEntregado },
            estado: { notIn: ['ANULADO'] },
            cliente_telefono: { not: null },
            encuestaPosventa: null, // Que no tenga encuesta enviada
          },
          select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true },
        });

        for (const p of pedidosParaEncuesta) {
          const telefono = normalizarTelefono(p.cliente_telefono || '');
          if (!telefono) continue;

          const acepta = await this.ventana24hService.tieneConsentimiento(telefono);
          if (!acepta) continue;

          const nombre = p.cliente_nombre || 'Cliente';

          // Registrar encuesta como ENVIADA
          await this.prisma.encuestaPosventa.create({
            data: {
              pedido_id: p.id,
              estado: 'ENVIADA',
              enviada_en: ahora,
            },
          });

          // Enviar con botones si ventana abierta, o plantilla si cerrada
          await this.ventana24hService.enviarMensajeNegocio(
            telefono,
            {
              textoLibre: `Hola ${nombre}, gracias por tu compra en Caprichos (pedido ${p.codigo}). ¿Como calificarias tu atencion del 1 al 5?`,
              plantillaClave: 'ENCUESTA_POSVENTA',
              variablesPlantilla: [nombre, p.codigo],
              botones: [
                { id: 'encuesta:1', titulo: '1 Malo' },
                { id: 'encuesta:3', titulo: '3 Regular' },
                { id: 'encuesta:5', titulo: '5 Excelente' },
              ],
            },
            { pedidoId: p.id },
          );

          resumen.avisosEncuesta++;
        }
      }

      if (this.tareaRecordatorioPago) {
        await this.tareaRecordatorioPago.ejecutarCiclo(ahora).catch((err) => {
          this.logger.error(`Error en ciclo de tareaRecordatorioPago: ${err.message}`, err.stack);
        });
      }

      return resumen;
    } finally {
      this.ejecutando = false;
      if (lockAdquirido && !lockFallback) {
        try {
          const redis = this.redisService.obtenerCliente();
          await liberarCandado(redis, lockKey, lockToken);
        } catch {}
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
