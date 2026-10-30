import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { Ventana24hService } from './ventana-24h.service';
import { ReservasService } from '../../reservas/reservas.service';
import { TEXTOS_RESERVA } from '../conversacion/textos-reserva';
import { obtenerFechaHoraLima } from '../../local/local.util';
import { normalizarTelefono } from '../utilidades/enmascarar.util';
import { adquirirCandado, liberarCandado } from '../../../comun/redis/candado.util';
import { OutboxWhatsappService } from './outbox-whatsapp.service';

@Injectable()
export class RecordatorioReservasTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecordatorioReservasTarea.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervaloMs = 30000; // 30 segundos
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly ventana24hService: Ventana24hService,
    @Optional()
    @Inject(forwardRef(() => ReservasService))
    private readonly reservasService?: ReservasService,
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
        this.logger.error(`Error en ciclo de recordatorio de reservas: ${err.message}`, err.stack);
      });
    }, this.intervaloMs);
    this.logger.log('Tarea de recordatorios y vencimientos de reservas iniciada (cada 30s).');
  }

  detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Consulta si el recordatorio automático está activo (`chatbot_reserva_recordatorio = 'si'`).
   * Por defecto 'no'.
   */
  async esRecordatorioActivo(): Promise<boolean> {
    try {
      const param = await this.prisma.parametro.findUnique({
        where: { clave: 'chatbot_reserva_recordatorio' },
      });
      if (!param || param.valor === null || param.valor === undefined) {
        return false;
      }
      const val = String(param.valor).toLowerCase().trim();
      return val === 'si' || val === 'true' || param.valor === true;
    } catch {
      return false;
    }
  }

  /**
   * Ejecuta un ciclo de verificación de recordatorios (2 horas antes) y aviso de tolerancia vencida.
   */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<{
    recordatoriosEnviados: number;
    vencidosNotificados: number;
    bloqueadoPorOtraInstancia?: boolean;
  }> {
    if (this.ejecutando) {
      return { recordatoriosEnviados: 0, vencidosNotificados: 0 };
    }

    this.ejecutando = true;
    const lockKey = 'lock:chatbot:recordatorio-reservas';
    let lockAdquirido = false;
    let lockFallback = false;
    let lockToken = '';
    let recordatoriosEnviados = 0;
    let vencidosNotificados = 0;

    try {
      const redis = this.redisService.obtenerCliente();
      const candado = await adquirirCandado(redis, lockKey, 25000);
      lockAdquirido = candado.adquirido;
      lockFallback = candado.fallback;
      lockToken = candado.token;

      if (!lockAdquirido) {
        return {
          recordatoriosEnviados: 0,
          vencidosNotificados: 0,
          bloqueadoPorOtraInstancia: true,
        };
      }
      // 1. RECORDATORIO 2 HORAS ANTES (Opcional según parámetro)
      const recordatorioActivo = await this.esRecordatorioActivo();
      if (recordatorioActivo) {
        const ahoraMs = ahora.getTime();
        // Ventana de 2 horas antes: entre 105 minutos y 135 minutos hacia el futuro
        const minVentana = new Date(ahoraMs + 105 * 60 * 1000);
        const maxVentana = new Date(ahoraMs + 135 * 60 * 1000);

        const reservasParaRecordar = await this.prisma.reserva.findMany({
          where: {
            estado: 'ACTIVA',
            recordatorio_enviado: false,
            hora: {
              gte: minVentana,
              lte: maxVentana,
            },
          },
        });

        for (const r of reservasParaRecordar) {
          const tel = normalizarTelefono(r.telefono);
          if (!tel) continue;

          const { horaMinutos } = obtenerFechaHoraLima(r.hora);
          const mensajeTexto = TEXTOS_RESERVA.recordatorioReservaCliente({
            nombre: r.nombre,
            personas: r.personas,
            hora: horaMinutos,
            toleranciaMin: r.tolerancia_min || 15,
          });

          // Marca de enviado y mensaje encolado en una sola transacción: el recordatorio no se repite
          await this.prisma.$transaction(async (tx) => {
            await tx.reserva.update({
              where: { id: r.id },
              data: { recordatorio_enviado: true },
            });
            await this.outbox!.encolar(
              {
                telefono: tel,
                tipo: 'TEXTO',
                clave: `reserva-recordatorio-${r.id}`,
                origen: 'RECORDATORIO_RESERVA',
                carga: {
                  textoLibre: mensajeTexto,
                  plantillaClave: 'RESERVA_RECORDATORIO',
                  variablesPlantilla: [r.nombre, horaMinutos],
                  autor: 'BOT',
                  nombre: r.nombre,
                  etapa: 'RECORDATORIO',
                },
              },
              tx,
            );
          }).catch((err) => {
            this.logger.warn(`No se pudo encolar recordatorio de reserva a ${tel}: ${err.message}`);
          });

          recordatoriosEnviados++;
        }
      }

      // 2. AVISO DE TOLERANCIA VENCIDA (NO_ASISTIO)
      if (this.reservasService) {
        // Encontrar reservas ACTIVAS que están por vencer antes de pasarlas a NO_ASISTIO
        const activasPorVencer = await this.prisma.reserva.findMany({
          where: { estado: 'ACTIVA' },
        });

        const vencidas = activasPorVencer.filter((r) => {
          const expira = new Date(r.hora.getTime() + (r.tolerancia_min || 15) * 60 * 1000);
          return ahora.getTime() >= expira.getTime();
        });

        // Pasar a NO_ASISTIO en ReservasService
        if (vencidas.length > 0) {
          await this.reservasService.pasarNoAsistioVencidas(ahora);

          for (const r of vencidas) {
            const tel = normalizarTelefono(r.telefono);
            if (!tel) continue;

            const { horaMinutos } = obtenerFechaHoraLima(r.hora);
            const mensajeAviso = TEXTOS_RESERVA.toleranciaVencidaCliente({
              nombre: r.nombre,
              hora: horaMinutos,
            });

            await this.outbox!.encolar({
              telefono: tel,
              tipo: 'TEXTO',
              clave: `reserva-tolerancia-${r.id}`,
              origen: 'RECORDATORIO_RESERVA',
              carga: {
                textoLibre: mensajeAviso,
                plantillaClave: 'RESERVA_ACTUALIZACION',
                variablesPlantilla: [r.nombre, `tolerancia vencida (${horaMinutos})`],
                autor: 'BOT',
                nombre: r.nombre,
                etapa: 'TOLERANCIA_VENCIDA',
              },
            }).catch((err) => {
              this.logger.warn(`No se pudo encolar aviso de tolerancia vencida a ${tel}: ${err.message}`);
            });

            vencidosNotificados++;
          }
        }
      }
      // Lo encolado en esta corrida sale ya
      this.outbox?.despertar();
    } finally {
      this.ejecutando = false;
      if (lockAdquirido && !lockFallback) {
        try {
          const redis = this.redisService.obtenerCliente();
          await liberarCandado(redis, lockKey, lockToken);
        } catch { /* liberar el candado es best-effort; expira solo por TTL */ }
      }
    }

    return { recordatoriosEnviados, vencidosNotificados };
  }
}
