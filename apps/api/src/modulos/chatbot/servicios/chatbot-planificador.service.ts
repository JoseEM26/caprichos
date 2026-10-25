import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { Ventana24hService } from './ventana-24h.service';
import { enmascararTelefono, hashTelefono, normalizarTelefono } from '../utilidades/enmascarar.util';

export interface ParametrosChatbot {
  avisoSalidaActivo: boolean;
  avisoLlegadaActivo: boolean;
  avisoEsperaActivo: boolean;
  avisoRecojoActivo: boolean;
  avisoPagoConfirmadoActivo: boolean;
  avisoEncuestaActivo: boolean;
  repartoInsistenciaMin: number;
  repartoEsperaMaxMin: number;
  repartoRecargoReprogramacion: number;
  encuestaEsperaMin: number;
  encuestaPuntajeQueja: number;
  tiempoPrometidoMin: number;
}

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
      'whatsapp_aviso_encuesta_activo',
      'reparto_insistencia_min',
      'reparto_espera_max_min',
      'reparto_recargo_reprogramacion',
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
      avisoEncuestaActivo: esActivo(mapa.get('whatsapp_aviso_encuesta_activo')),
      repartoInsistenciaMin: Number(mapa.get('reparto_insistencia_min') ?? 3),
      repartoEsperaMaxMin: Number(mapa.get('reparto_espera_max_min') ?? 10),
      repartoRecargoReprogramacion: Number(mapa.get('reparto_recargo_reprogramacion') ?? 0),
      encuestaEsperaMin: Number(mapa.get('encuesta_espera_min') ?? 30),
      encuestaPuntajeQueja: Number(mapa.get('encuesta_puntaje_queja') ?? 2),
      tiempoPrometidoMin: Number(mapa.get('tiempo_prometido_min') ?? 30),
    };
  }

  /**
   * Ejecuta un ciclo de evaluación de pedidos con bloqueo distribuido en Redis (ioredis).
   */
  async ejecutarCiclo(): Promise<{
    bloqueadoPorOtraInstancia: boolean;
    avisosSalida: number;
    avisosLlegada: number;
    avisosInsistencia: number;
    avisosEspera: number;
    avisosPago: number;
    avisosRecojo: number;
    avisosEncuesta: number;
  }> {
    if (this.ejecutando) {
      return {
        bloqueadoPorOtraInstancia: true,
        avisosSalida: 0,
        avisosLlegada: 0,
        avisosInsistencia: 0,
        avisosEspera: 0,
        avisosPago: 0,
        avisosRecojo: 0,
        avisosEncuesta: 0,
      };
    }

    this.ejecutando = true;
    const lockKey = 'lock:chatbot:planificador';
    const lockVal = `${Date.now()}-${Math.random()}`;
    let lockAdquirido = false;

    try {
      const redis = this.redisService.obtenerCliente();
      // Bloqueo distribuido de 25 segundos para evitar ejecuciones concurrentes entre réplicas
      const resLock = await redis.set(lockKey, lockVal, 'EX', 25, 'NX').catch(() => null);
      lockAdquirido = resLock === 'OK';

      if (!lockAdquirido) {
        return {
          bloqueadoPorOtraInstancia: true,
          avisosSalida: 0,
          avisosLlegada: 0,
          avisosInsistencia: 0,
          avisosEspera: 0,
          avisosPago: 0,
          avisosRecojo: 0,
          avisosEncuesta: 0,
        };
      }

      const params = await this.obtenerParametros();
      const ahora = new Date();

      let avisosSalida = 0;
      let avisosLlegada = 0;
      let avisosInsistencia = 0;
      let avisosEspera = 0;
      let avisosPago = 0;
      let avisosRecojo = 0;
      let avisosEncuesta = 0;

      // 1. Delivery: Salida, Llegada, Insistencia y Espera agotada
      const pedidosDelivery = await this.prisma.pedido.findMany({
        where: {
          modalidad: 'DELIVERY',
          estado: { notIn: ['ANULADO'] },
          cliente_telefono: { not: null },
        },
        include: {
          mensajesReparto: true,
        },
      });

      for (const p of pedidosDelivery) {
        const telefono = normalizarTelefono(p.cliente_telefono || '');
        if (!telefono) continue;

        // Consentimiento Ley 29733: no enviar si dijo BAJA
        const acepta = await this.ventana24hService.tieneConsentimiento(telefono);
        if (!acepta) continue;

        const nombreCliente = p.cliente_nombre || 'Cliente';

        // (a) DELIVERY SALE (aviso 1)
        if (params.avisoSalidaActivo && p.salio_en) {
          const yaAviso1 = p.mensajesReparto.some((m) => m.numero === 1);
          if (!yaAviso1) {
            const tiempoEst = String(params.tiempoPrometidoMin);
            const resultado = await this.ventana24hService.enviarMensajeNegocio(
              telefono,
              {
                textoLibre: `Hola ${nombreCliente}, tu pedido ${p.codigo} ya salio de nuestro local y va en camino. Tiempo estimado: ${tiempoEst} minutos.`,
                plantillaClave: 'DELIVERY_SALIDA',
                variablesPlantilla: [nombreCliente, p.codigo, tiempoEst],
              },
              { pedidoId: p.id },
            );

            await this.prisma.mensajeReparto.create({
              data: {
                pedido_id: p.id,
                numero: 1,
                enviado_en: ahora,
                estado: resultado.exito ? 'ENVIADO' : 'FALLIDO',
              },
            });
            avisosSalida++;
          }
        }

        // (b) DELIVERY LLEGO (aviso 2)
        if (params.avisoLlegadaActivo && p.llego_en) {
          const yaAviso2 = p.mensajesReparto.some((m) => m.numero === 2);
          if (!yaAviso2) {
            const resultado = await this.ventana24hService.enviarMensajeNegocio(
              telefono,
              {
                textoLibre: `Hola ${nombreCliente}, nuestro repartidor ya llego con tu pedido ${p.codigo} y esta esperando en la puerta. Por favor sal a recibirlo.`,
                plantillaClave: 'DELIVERY_LLEGADA',
                variablesPlantilla: [nombreCliente, p.codigo],
              },
              { pedidoId: p.id },
            );

            await this.prisma.mensajeReparto.create({
              data: {
                pedido_id: p.id,
                numero: 2,
                enviado_en: ahora,
                estado: resultado.exito ? 'ENVIADO' : 'FALLIDO',
              },
            });
            avisosLlegada++;
          }

          // (b2) INSISTENCIA (aviso 3) a los N minutos sin respuesta ni entrega
          if (!p.entregado_en) {
            const diffMinLlegada = (ahora.getTime() - p.llego_en.getTime()) / 60000;
            const yaAviso3 = p.mensajesReparto.some((m) => m.numero === 3);

            if (diffMinLlegada >= params.repartoInsistenciaMin && !yaAviso3) {
              const minutosEsperando = Math.floor(diffMinLlegada);
              const resultado = await this.ventana24hService.enviarMensajeNegocio(
                telefono,
                {
                  textoLibre: `Hola ${nombreCliente}, nuestro repartidor sigue esperando en la puerta con tu pedido ${p.codigo} desde hace ${minutosEsperando} minutos. Por favor sal o comunicate con nosotros.`,
                  plantillaClave: 'DELIVERY_INSISTENCIA',
                  variablesPlantilla: [nombreCliente, p.codigo, String(minutosEsperando)],
                },
                { pedidoId: p.id },
              );

              await this.prisma.mensajeReparto.create({
                data: {
                  pedido_id: p.id,
                  numero: 3,
                  enviado_en: ahora,
                  estado: resultado.exito ? 'ENVIADO' : 'FALLIDO',
                },
              });
              avisosInsistencia++;
            }

            // (c) ESPERA AGOTADA / REPROGRAMACION tras reparto_espera_max_min
            if (params.avisoEsperaActivo && diffMinLlegada >= params.repartoEsperaMaxMin) {
              // Verificar si ya notificamos espera agotada para este pedido
              const yaAvisoEspera = await this.prisma.whatsappMensaje.findFirst({
                where: {
                  pedido_id: p.id,
                  direccion: 'SALIENTE',
                  OR: [
                    { tipo: 'BOTON' },
                    { plantilla: 'caprichos_delivery_reprogramacion' },
                  ],
                },
              });

              if (!yaAvisoEspera) {
                const montoRecargoStr = `S/ ${params.repartoRecargoReprogramacion.toFixed(2)}`;
                await this.ventana24hService.enviarMensajeNegocio(
                  telefono,
                  {
                    textoLibre: `Hola ${nombreCliente}, se agoto el tiempo de espera en la puerta para tu pedido ${p.codigo} y el repartidor debe retirarse. Puedes solicitar la reprogramacion del envio con un recargo adicional de ${montoRecargoStr}. ¿Deseas reprogramar la entrega?`,
                    plantillaClave: 'DELIVERY_ESPERA_AGOTADA',
                    variablesPlantilla: [nombreCliente, p.codigo, montoRecargoStr],
                    botones: [
                      { id: 'reprogramar_si', titulo: 'Si reprogramar' },
                      { id: 'reprogramar_no', titulo: 'No gracias' },
                    ],
                  },
                  { pedidoId: p.id },
                );

                // Avisar a Caja por la campana interna para coordinar
                const tituloNotif = 'Espera agotada en entrega de pedido';
                const detalleNotif = `Repartidor superó los ${params.repartoEsperaMaxMin} min de espera en la puerta para ${p.codigo}. Se envió aviso de reprogramación al cliente.`;

                const notif = await this.prisma.notificacion.create({
                  data: {
                    tipo: 'ESPERA_AGOTADA',
                    rol_destino: 'CAJA',
                    titulo: tituloNotif,
                    mensaje: detalleNotif,
                    enlace: '/admin/caja',
                  },
                });

                this.eventos?.emitirAdmin('notificaciones:nueva', {
                  id: notif.id.toString(),
                  titulo: tituloNotif,
                });

                avisosEspera++;
              }
            }
          }
        }
      }

      // (d) VOUCHER / PAGO CONFIRMADO POR CAJA
      if (params.avisoPagoConfirmadoActivo) {
        const pedidosPagados = await this.prisma.pedido.findMany({
          where: {
            pago_estado: 'PAGADO',
            confirmado_en: { not: null },
            estado: { notIn: ['ANULADO'] },
            cliente_telefono: { not: null },
          },
          select: { id: true, codigo: true, cliente_nombre: true, cliente_telefono: true },
        });

        for (const p of pedidosPagados) {
          const telefono = normalizarTelefono(p.cliente_telefono || '');
          if (!telefono) continue;

          const yaEnviado = await this.prisma.whatsappMensaje.findFirst({
            where: {
              pedido_id: p.id,
              direccion: 'SALIENTE',
              OR: [
                { plantilla: 'caprichos_pago_confirmado' },
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
                textoLibre: `Recibimos tu pago, tu pedido ${p.codigo} esta en preparacion.`,
                plantillaClave: 'PAGO_CONFIRMADO',
                variablesPlantilla: [nombre, p.codigo],
              },
              { pedidoId: p.id },
            );
            avisosPago++;
          }
        }
      }

      // (e) PEDIDO LISTO PARA RECOGER (modalidad RECOJO / LLEVAR)
      if (params.avisoRecojoActivo) {
        const pedidosRecojo = await this.prisma.pedido.findMany({
          where: {
            modalidad: { in: ['RECOJO', 'LLEVAR'] },
            estado: 'LISTO',
            listo_en: { not: null },
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
                textoLibre: `Hola ${nombre}, tu pedido ${p.codigo} ya esta listo para recoger en nuestro local. ¡Te esperamos!`,
                plantillaClave: 'PEDIDO_LISTO_RECOJO',
                variablesPlantilla: [nombre, p.codigo],
              },
              { pedidoId: p.id },
            );
            avisosRecojo++;
          }
        }
      }

      // (f) ENCUESTA POSVENTA tras X minutos de ENTREGADO
      if (params.avisoEncuestaActivo) {
        const limiteEntregado = new Date(ahora.getTime() - params.encuestaEsperaMin * 60000);
        const pedidosParaEncuesta = await this.prisma.pedido.findMany({
          where: {
            entregado_en: { lte: limiteEntregado },
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

          avisosEncuesta++;
        }
      }

      return {
        bloqueadoPorOtraInstancia: false,
        avisosSalida,
        avisosLlegada,
        avisosInsistencia,
        avisosEspera,
        avisosPago,
        avisosRecojo,
        avisosEncuesta,
      };
    } finally {
      this.ejecutando = false;
      if (lockAdquirido) {
        try {
          const redis = this.redisService.obtenerCliente();
          await redis.del(lockKey).catch(() => {});
        } catch {}
      }
    }
  }
}
