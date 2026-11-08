import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { flujoLiberadoParaBot } from '../conversacion/flujo-liberado.util';
import { botPausadoHasta, diaLima, minutoDelDiaLima, ultimaIntervencionHumana } from '../conversacion/reanudacion-bot.util';

export const MOTIVO_REANUDADO = 'Reanudado a las 00:01';

/**
 * Cada día a las 00:01 (Lima) devuelve al bot los chats que una persona atendió un día anterior.
 * No toca chats con pago por revisar (VALIDAR_PAGO) ni con un delivery en curso: siguen con Caja.
 */
@Injectable()
export class ReanudacionBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReanudacionBotService.name);
  private timer: NodeJS.Timeout | null = null;
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    // ponytail: sondeo cada minuto + candado diario en Redis; un cron exacto no aporta nada más.
    this.timer = setInterval(() => {
      this.ejecutarCiclo().catch((err) => this.logger.error(`Reanudación del bot: ${err.message}`, err.stack));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Libera los chats vencidos una sola vez por día (candado Redis). Devuelve cuántos liberó. */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<number> {
    if (this.ejecutando) return 0;
    // 00:00 todavía no cuenta: la reanudación es a las 00:01 de Lima (el candado diario se toma recién desde ahí).
    if (minutoDelDiaLima(ahora) < 1) return 0;
    this.ejecutando = true;
    const clave = `chatbot:reanudacion:${diaLima(ahora)}`;
    let redis: ReturnType<RedisService['obtenerCliente']> | null = null;
    try {
      redis = this.redisService.obtenerCliente();
      // Antes de las 00:01 no hay nada vencido: el candado diario se toma al primer ciclo útil del día.
      const ok = await redis.set(clave, '1', 'EX', 172800, 'NX');
      if (ok !== 'OK') return 0;
      return await this.liberarVencidos(ahora);
    } catch (err: any) {
      try {
        await redis?.del(clave);
      } catch {
        /* sin Redis no hay candado que soltar */
      }
      throw err;
    } finally {
      this.ejecutando = false;
    }
  }

  async liberarVencidos(ahora: Date = new Date()): Promise<number> {
    const candidatos = await this.prisma.conversacion.findMany({
      where: { estado: { not: 'VALIDAR_PAGO' }, OR: [{ duenio: 'PERSONA' }, { tomado_por: { not: null } }] },
      select: { id: true, telefono: true, estado: true, flujo: true, tomado_en: true },
    });
    let liberados = 0;
    for (const c of candidatos) {
      const ultimo = await this.prisma.mensajeChat.findFirst({
        where: { conversacion_id: c.id, direccion: 'SALE', autor: 'PERSONA' },
        orderBy: { en: 'desc' },
        select: { en: true },
      });
      const intervencion = ultimaIntervencionHumana(ultimo?.en, c.tomado_en);
      // Sin intervención humana (derivado por el bot y sin atender) o de hoy: se queda como está.
      if (!intervencion || ahora.getTime() < botPausadoHasta(intervencion).getTime()) continue;
      if (await this.liberarUna(c, ahora)) liberados++;
    }
    if (liberados > 0) this.logger.log(`Reanudación 00:01: ${liberados} chat(s) devueltos al bot.`);
    return liberados;
  }

  private async tieneDeliveryEnCurso(telefono: string): Promise<boolean> {
    const n = await this.prisma.pedido.count({
      where: {
        modalidad: 'DELIVERY',
        estado: { notIn: ['ENTREGADO', 'ANULADO'] },
        cliente_telefono: { endsWith: telefono.slice(-9) },
      },
    });
    return n > 0;
  }

  /** Devuelve el chat al bot salvo que haya pago por revisar o un delivery en curso (siguen con Caja). */
  async liberarUna(c: { id: bigint; telefono: string; estado: string; flujo: unknown }, ahora: Date = new Date()): Promise<boolean> {
    if (c.estado === 'VALIDAR_PAGO' || (await this.tieneDeliveryEnCurso(c.telefono))) return false;
    await this.liberar(c, ahora);
    return true;
  }

  private async liberar(c: { id: bigint; flujo: unknown }, ahora: Date): Promise<void> {
    const flujo = { ...flujoLiberadoParaBot(c.flujo), reanudado_en: ahora.toISOString() };
    await this.prisma.conversacion.update({
      where: { id: c.id },
      data: { duenio: 'BOT', tomado_por: null, tomado_en: null, motivo_derivacion: null, flujo: flujo as any },
    });
    await this.prisma.mensajeChat.create({
      data: {
        conversacion_id: c.id,
        direccion: 'SALE',
        autor: 'BOT',
        tipo: 'SISTEMA',
        contenido: { texto: MOTIVO_REANUDADO, reanudado: true } as any,
      },
    });
    this.eventos?.emitirAdmin('mensajes:actualizado', { id: c.id.toString() });
  }
}
