import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { adquirirCandado, liberarCandado } from '../../../comun/redis/candado.util';
import { EjecutorConversacionService } from '../conversacion/ejecutor-conversacion.service';
import { obtenerNombreMostrar } from '../../mensajes/utilidades/nombre-contacto.util';

/**
 * Vigilante de chats sin respuesta: cada minuto busca conversaciones cuyo ÚLTIMO mensaje es del cliente
 * (sin respuesta del bot, de una persona ni evento de silencio posterior) hace más de N minutos y que
 * nadie tomó. Avisa una vez por mensaje (campana a Admin y Caja) y reintenta una vez procesarlo con el bot.
 * Con dos contenedores solo corre uno (candado Redis) y las marcas por mensaje son idempotentes.
 */
@Injectable()
export class VigilanteSinRespuestaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VigilanteSinRespuestaService.name);
  private timer: NodeJS.Timeout | null = null;
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional() private readonly motor?: EjecutorConversacionService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.ejecutarCiclo().catch((e) => this.logger.error(`Vigilante sin respuesta: ${e.message}`));
    }, 60000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async parametro(clave: string): Promise<string | null> {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    return p?.valor != null ? String(p.valor) : null;
  }

  private async primeraVez(clave: string): Promise<boolean> {
    try {
      const r = await this.redisService.obtenerCliente().set(clave, '1', 'EX', 7 * 86400, 'NX');
      return r === 'OK';
    } catch {
      return true;
    }
  }

  async ejecutarCiclo(ahora: Date = new Date()): Promise<{ avisos: number; reintentos: number }> {
    if (this.ejecutando) return { avisos: 0, reintentos: 0 };
    this.ejecutando = true;
    const redis = this.redisService.obtenerCliente();
    const lockKey = 'lock:chatbot:vigilante-sin-respuesta';
    const candado = await adquirirCandado(redis, lockKey, 50000);
    let avisos = 0;
    let reintentos = 0;
    try {
      if (!candado.adquirido) return { avisos, reintentos };
      const n = Number(await this.parametro('vigilante_sin_respuesta_min'));
      const minutos = n > 0 ? n : 3;
      const botActivo = String((await this.parametro('chatbot_activo')) ?? 'si').toLowerCase() === 'si';

      const convs = await this.prisma.conversacion.findMany({
        where: { tomado_por: null, ultima_actividad: { gte: new Date(ahora.getTime() - 24 * 3600 * 1000) } },
        include: { mensajes: { orderBy: { en: 'desc' }, take: 1 } },
      });

      for (const conv of convs) {
        const ult = (conv as any).mensajes?.[0];
        if (!ult || ult.direccion !== 'ENTRA') continue;
        const espera = (ahora.getTime() - new Date(ult.en).getTime()) / 60000;
        if (espera < minutos) continue;

        if (await this.primeraVez(`idemp:vigilante:aviso:${ult.id}`)) {
          const titulo = `Chat sin respuesta: ${obtenerNombreMostrar(conv as any)}`;
          const mensaje = `El cliente escribió hace ${Math.floor(espera)} min y nadie le respondió. Abre el chat y respóndele.`;
          const tel = String(conv.telefono || '').replace(/\D/g, '');
          const enlace = tel.length >= 9 ? `/admin/mensajes?telefono=${tel}` : '/admin/mensajes';
          for (const rol of ['ADMIN', 'CAJERO']) {
            const notif = await this.prisma.notificacion.create({
              data: { tipo: 'CHAT_SIN_RESPUESTA', rol_destino: rol, titulo, mensaje, enlace },
            });
            this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo, mensaje, enlace });
          }
          this.eventos?.emitirAdmin('mensajes:actualizado', { id: conv.id.toString() });
          avisos++;
        }

        const texto = String((ult.contenido as any)?.texto || '').trim();
        if (botActivo && this.motor && ult.tipo === 'TEXTO' && texto && (await this.primeraVez(`idemp:vigilante:reintento:${ult.id}`))) {
          try {
            await this.motor.procesarMensajeEntrante(conv.id, { texto });
            reintentos++;
          } catch (e: any) {
            this.logger.warn(`Reintento del chat ${conv.id} falló: ${e.message}`);
          }
        }
      }
      return { avisos, reintentos };
    } finally {
      if (candado.adquirido) await liberarCandado(redis, lockKey, candado.token).catch(() => {});
      this.ejecutando = false;
    }
  }
}
