import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { Ventana24hService } from './ventana-24h.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';
import { TEXTOS_PAGO } from '../conversacion/flujos/pago/textos-pago';
import { enmascararTelefono, hashTelefono, normalizarTelefono } from '../utilidades/enmascarar.util';

export interface ParametrosRecordatorioPago {
  recordatorioActivo: boolean;
  recordatorioMin: number;
  expiraMin: number;
}

@Injectable()
export class TareaRecordatorioPagoService {
  private readonly logger = new Logger(TareaRecordatorioPagoService.name);
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly ventana24hService: Ventana24hService,
    @Optional() private readonly eventos?: EventosGateway,
    @Optional()
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria?: WhatsAppMensajeriaPuerto,
  ) {}

  /**
   * Carga los parámetros operativos desde la base de datos (tabla parametro).
   * - chatbot_pago_recordatorio_activo: 'si' / 'no' (por defecto 'si')
   * - chatbot_pago_recordatorio_min: número de minutos (por defecto 10)
   * - chatbot_pago_expira_min: número de minutos (por defecto 30; 0 apaga aviso)
   */
  async obtenerParametros(): Promise<ParametrosRecordatorioPago> {
    const claves = [
      'chatbot_pago_recordatorio_activo',
      'chatbot_pago_recordatorio_min',
      'chatbot_pago_expira_min',
    ];

    try {
      const parametrosDb = await this.prisma.parametro.findMany({
        where: { clave: { in: claves } },
      });

      const mapa = new Map<string, any>();
      for (const p of parametrosDb) {
        mapa.set(p.clave, p.valor);
      }

      const valActivo = mapa.get('chatbot_pago_recordatorio_activo');
      const recordatorioActivo =
        valActivo === undefined || valActivo === null
          ? true
          : String(valActivo).toLowerCase().trim() === 'si' ||
            valActivo === true ||
            String(valActivo) === 'true';

      const valMin = Number(mapa.get('chatbot_pago_recordatorio_min'));
      const recordatorioMin = !isNaN(valMin) && valMin > 0 ? valMin : 10;

      const valExpira = Number(mapa.get('chatbot_pago_expira_min'));
      const expiraMin = !isNaN(valExpira) && valExpira >= 0 ? valExpira : 30;

      return {
        recordatorioActivo,
        recordatorioMin,
        expiraMin,
      };
    } catch (err: any) {
      this.logger.warn(`Error al leer parámetros de pago: ${err.message}. Usando valores por defecto.`);
      return {
        recordatorioActivo: true,
        recordatorioMin: 10,
        expiraMin: 30,
      };
    }
  }

  /**
   * Ejecuta el ciclo de recordatorio idempotente y alerta de expiración a Caja.
   * Totalmente desacoplado de la lógica de reparto existente.
   */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<{
    recordatoriosEnviados: number;
    alertasCajaEnviadas: number;
  }> {
    if (this.ejecutando) {
      return { recordatoriosEnviados: 0, alertasCajaEnviadas: 0 };
    }

    this.ejecutando = true;
    let recordatoriosEnviados = 0;
    let alertasCajaEnviadas = 0;

    try {
      const params = await this.obtenerParametros();

      // Consultar pedidos pendientes con medio de pago digital de las últimas 24 horas
      const hace24h = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
      const pedidosPendientes = await this.prisma.pedido.findMany({
        where: {
          pago_metodo: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] },
          pago_estado: 'PENDIENTE',
          estado: { notIn: ['ANULADO'] },
          creado_en: { gte: hace24h },
        },
        select: {
          id: true,
          codigo: true,
          cliente_nombre: true,
          cliente_telefono: true,
          total: true,
          pago_metodo: true,
          creado_en: true,
        },
      });

      if (pedidosPendientes.length === 0) {
        return { recordatoriosEnviados: 0, alertasCajaEnviadas: 0 };
      }

      const redis = this.redisService ? this.redisService.obtenerCliente() : null;

      for (const p of pedidosPendientes) {
        const transcurridoMin = Math.floor(
          (ahora.getTime() - new Date(p.creado_en).getTime()) / (60 * 1000),
        );

        // Teléfono del cliente
        const telNorm = p.cliente_telefono ? normalizarTelefono(p.cliente_telefono) : null;
        if (!telNorm) continue;

        // 1. EVALUAR RECORDATORIO AL CLIENTE
        if (params.recordatorioActivo && transcurridoMin >= params.recordatorioMin) {
          const redisKeyRecordatorio = `chatbot:pago:recordatorio:${p.id}`;
          let yaEnviado = false;

          if (redis) {
            try {
              const resSet = await redis.set(redisKeyRecordatorio, '1', 'EX', 86400, 'NX');
              yaEnviado = resSet !== 'OK';
            } catch {
              yaEnviado = false;
            }
          }

          if (!yaEnviado) {
            // Verificar si el cliente ya subió comprobante (conversación en VALIDAR_PAGO)
            const conv = await this.prisma.conversacion.findFirst({
              where: {
                OR: [
                  { telefono: telNorm },
                  ...(p.cliente_telefono ? [{ telefono: p.cliente_telefono }] : []),
                ],
              },
              select: { id: true, estado: true, flujo: true },
            });

            const estadoConv = conv?.estado;
            const estadoFlujoPago = (conv?.flujo as any)?.pago?.estadoInterno;
            const tieneCapturaEnRevision =
              estadoConv === 'VALIDAR_PAGO' || estadoFlujoPago === 'VALIDAR_PAGO';

            // Solo enviar si el cliente aún no ha enviado la captura
            if (!tieneCapturaEnRevision) {
              const textoMensaje = TEXTOS_PAGO.pagoRecordatorioCliente(
                p.cliente_nombre || 'Cliente',
                p.codigo,
                Number(p.total),
                p.pago_metodo || 'digital',
              );

              try {
                await this.ventana24hService.enviarMensajeNegocio(telNorm, {
                  textoLibre: textoMensaje,
                });
                recordatoriosEnviados++;
                this.logger.log(
                  `Recordatorio de pago enviado para pedido ${p.codigo} (${enmascararTelefono(telNorm)})`,
                );
              } catch (err: any) {
                this.logger.error(
                  `Error al enviar recordatorio de pago para pedido ${p.codigo}: ${err.message}`,
                );
              }
            }
          }
        }

        // 2. EVALUAR ALERTA DE EXPIRACIÓN A CAJA (NO ANULA SOLO)
        if (params.expiraMin > 0 && transcurridoMin >= params.expiraMin) {
          const redisKeyExpira = `chatbot:pago:expira_alerta:${p.id}`;
          let yaAlertado = false;

          if (redis) {
            try {
              const resSet = await redis.set(redisKeyExpira, '1', 'EX', 86400, 'NX');
              yaAlertado = resSet !== 'OK';
            } catch {
              yaAlertado = false;
            }
          }

          if (!yaAlertado) {
            const tituloNotif = `Pago pendiente por expirar: ${p.codigo}`;
            const mensajeNotif = `El pedido ${p.codigo} lleva más de ${params.expiraMin} minutos sin comprobante de pago. Caja debe decidir si contactar al cliente o anular.`;

            try {
              const notif = await this.prisma.notificacion.create({
                data: {
                  tipo: 'ATENCION_WHATSAPP',
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

              alertasCajaEnviadas++;
              this.logger.warn(
                `Alerta de pago por expirar notificada a Caja para pedido ${p.codigo}.`,
              );
            } catch (err: any) {
              this.logger.error(
                `Error al crear notificación de expiración para pedido ${p.codigo}: ${err.message}`,
              );
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error en ciclo de recordatorio de pagos: ${err.message}`, err.stack);
    } finally {
      this.ejecutando = false;
    }

    return { recordatoriosEnviados, alertasCajaEnviadas };
  }
}
