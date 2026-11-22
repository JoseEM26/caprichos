import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { flujoLiberadoParaBot } from '../conversacion/flujo-liberado.util';
import { BOT_REANUDA_MIN_DEFECTO, PARAM_BOT_REANUDA_MIN, botPausadoPorPersona, ultimaIntervencionHumana } from '../conversacion/reanudacion-bot.util';

export const MOTIVO_REANUDADO = 'El bot retomó el chat: nadie del equipo escribió en los últimos minutos';

/**
 * Cada minuto devuelve al bot los chats que una persona atendió y donde nadie del equipo escribió en `bot_reanuda_min` (20) minutos
 * (también libera un chat «tomado» sin actividad). No toca chats con pago por revisar (VALIDAR_PAGO) ni con un delivery en curso.
 */
@Injectable()
export class ReanudacionBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReanudacionBotService.name);
  private timer: NodeJS.Timeout | null = null;
  private ejecutando = false;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.ejecutarCiclo().catch((err) => this.logger.error(`Reanudación del bot: ${err.message}`, err.stack));
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async ejecutarCiclo(ahora: Date = new Date()): Promise<number> {
    if (this.ejecutando) return 0;
    this.ejecutando = true;
    try {
      return await this.liberarVencidos(ahora);
    } finally {
      this.ejecutando = false;
    }
  }

  private async minutosEspera(): Promise<number> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: PARAM_BOT_REANUDA_MIN } });
      const n = Number(p?.valor);
      if (p && p.valor != null && n > 0) return n;
    } catch {
      /* sin parámetro: el de siempre */
    }
    return BOT_REANUDA_MIN_DEFECTO;
  }

  async liberarVencidos(ahora: Date = new Date()): Promise<number> {
    const esperaMin = await this.minutosEspera();
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
      const intervencion = ultimaIntervencionHumana(ultimo?.en, c.tomado_en, (c as any).atendido_en);
      // Sin intervención humana (derivado por el bot y sin atender) o con el equipo conversando: se queda como está.
      if (!intervencion || botPausadoPorPersona(intervencion, ahora, esperaMin)) continue;
      if (await this.liberarUna(c, ahora)) liberados++;
    }
    if (liberados > 0) this.logger.log(`Reanudación del bot: ${liberados} chat(s) devueltos al bot.`);
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
