import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { EvolutionConfigService } from './evolution-config.service';

const DIA_MS = 24 * 3_600_000;
const CACHE_PROMEDIO_MS = 10 * 60_000;

/** Inicio del día en Lima (UTC-5, sin horario de verano) como instante UTC. */
export const inicioDiaLima = (d: Date): Date => new Date(Math.floor((d.getTime() - 5 * 3_600_000) / DIA_MS) * DIA_MS + 5 * 3_600_000);

/** Umbral diario de alerta: `factor` veces el promedio de 7 días, con un mínimo. */
export const umbralDiario = (promedio7: number, factor: number, minimo: number): number => Math.max(minimo, Math.ceil(promedio7 * factor));

/**
 * Cuenta los mensajes SALIENTES del número (whatsapp_mensaje, sin tabla nueva) y avisa a los ADMIN por la campanita
 * cuando el día se dispara o un chat recibe demasiados en una hora. Una alerta por día (y por chat).
 */
@Injectable()
export class ContadorSalientesService {
  private readonly logger = new Logger(ContadorSalientesService.name);
  private promedioCache: { en: number; valor: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: EvolutionConfigService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  private async promedio7(ahora: Date): Promise<number> {
    if (this.promedioCache && ahora.getTime() - this.promedioCache.en < CACHE_PROMEDIO_MS) return this.promedioCache.valor;
    const hoy = inicioDiaLima(ahora);
    const n = await this.prisma.whatsappMensaje.count({ where: { direccion: 'SALIENTE', creado_en: { gte: new Date(hoy.getTime() - 7 * DIA_MS), lt: hoy } } });
    const valor = Math.round((n / 7) * 10) / 10;
    this.promedioCache = { en: ahora.getTime(), valor };
    return valor;
  }

  /** Para la pantalla de estado: salientes de hoy, promedio de los 7 días anteriores y el umbral de alerta vigente. */
  async resumen(ahora = new Date()): Promise<{ hoy: number; promedio7: number; umbral: number }> {
    const cfg = await this.config.obtener();
    const hoy = await this.prisma.whatsappMensaje.count({ where: { direccion: 'SALIENTE', creado_en: { gte: inicioDiaLima(ahora) } } });
    const promedio7 = await this.promedio7(ahora);
    return { hoy, promedio7, umbral: umbralDiario(promedio7, cfg.evolution_alerta_dia_factor, cfg.evolution_alerta_dia_minimo) };
  }

  /** Lo llama el adaptador tras cada envío. Nunca lanza. */
  async vigilar(telefonoHash: string, telefonoMascara: string, ahora = new Date()): Promise<void> {
    try {
      const cfg = await this.config.obtener();
      const { hoy, umbral, promedio7 } = await this.resumen(ahora);
      if (hoy > umbral) {
        await this.alertar(
          'WhatsApp: volumen diario alto',
          `Hoy el número lleva ${hoy} mensajes salientes (promedio de 7 días: ${promedio7}; alerta sobre ${umbral}). Un volumen fuera de lo normal puede bloquear el número: revisa Mensajes.`,
          ahora,
        );
      }
      if (cfg.evolution_alerta_chat_hora > 0) {
        const enHora = await this.prisma.whatsappMensaje.count({
          where: { direccion: 'SALIENTE', telefono_hash: telefonoHash, creado_en: { gte: new Date(ahora.getTime() - 3_600_000) } },
        });
        if (enHora > cfg.evolution_alerta_chat_hora) {
          await this.alertar(
            `WhatsApp: demasiados mensajes a ${telefonoMascara}`,
            `Un mismo chat (${telefonoMascara}) recibió ${enHora} mensajes en la última hora (alerta sobre ${cfg.evolution_alerta_chat_hora}). Puede ser un bucle: revisa ese chat.`,
            ahora,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`No se pudo vigilar el conteo de salientes: ${err?.message}`);
    }
  }

  /** Una sola notificación por título y por día (el título lleva el chat cuando es por chat). */
  private async alertar(titulo: string, mensaje: string, ahora: Date): Promise<void> {
    const ya = await this.prisma.notificacion.findFirst({
      where: { tipo: 'WHATSAPP_ALERTA', rol_destino: 'ADMIN', titulo, en: { gte: inicioDiaLima(ahora) } },
      select: { id: true },
    });
    if (ya) return;
    const notif = await this.prisma.notificacion.create({
      data: { tipo: 'WHATSAPP_ALERTA', rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/mensajes' },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
  }
}
