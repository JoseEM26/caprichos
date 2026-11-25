import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { adquirirCandado, liberarCandado } from '../../../comun/redis/candado.util';
import { LocalService } from '../../local/local.service';
import { obtenerFechaHoraLima } from '../../local/local.util';

/** Minutos sin ningún mensaje entrante (con el local abierto) para avisar. Parámetro: whatsapp_vigia_entrada_min. */
export const MINUTOS_VIGIA_POR_DEFECTO = 20;

/**
 * Vigía de entrada de WhatsApp (Evolution): Evolution puede quedar «conectado» y enviando pero sin recibir nada
 * (25/11: v2.3.7 no confirmaba los Estados y WhatsApp retenía los mensajes). Cada minuto, con el local abierto, mira
 * el último mensaje ENTRANTE; si pasaron N minutos, avisa UNA vez al ADMIN (campana) por ese silencio.
 * ponytail: solo avisa (no reinicia solo); el reinicio es la acción «reiniciar-evolution» del despliegue.
 */
@Injectable()
export class VigiaEntradaWhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VigiaEntradaWhatsappService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    @Optional() private readonly local?: LocalService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.ejecutarCiclo().catch((e) => this.logger.error(`Vigía de entrada WhatsApp: ${e.message}`));
    }, 60000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async parametro(clave: string): Promise<string> {
    const p = await this.prisma.parametro.findUnique({ where: { clave } });
    return p?.valor != null ? String(p.valor).replace(/^"|"$/g, '') : '';
  }

  /** true si avisó en este ciclo. */
  async ejecutarCiclo(ahora: Date = new Date()): Promise<boolean> {
    if ((await this.parametro('whatsapp_proveedor')).toUpperCase() !== 'EVOLUTION') return false;
    if ((await this.parametro('evolution_pausado')).toLowerCase() === 'si') return false;
    const abierto = await this.local?.obtenerEstadoCarta(ahora).then((e) => e.abierta).catch(() => false);
    if (!abierto) return false;

    const n = Number(await this.parametro('whatsapp_vigia_entrada_min'));
    const minutos = n > 0 ? n : MINUTOS_VIGIA_POR_DEFECTO;
    const ultimo = await this.prisma.whatsappMensaje.findFirst({
      where: { direccion: 'ENTRANTE' },
      orderBy: { creado_en: 'desc' },
      select: { id: true, creado_en: true },
    });
    if (!ultimo) return false;
    const sinEntrar = (ahora.getTime() - ultimo.creado_en.getTime()) / 60000;
    if (sinEntrar < minutos) return false;

    const redis = this.redisService.obtenerCliente();
    const candado = await adquirirCandado(redis, 'lock:chatbot:vigia-entrada', 50000);
    if (!candado.adquirido) return false;
    try {
      // Un aviso por silencio: la marca es el último mensaje que sí entró
      const primera = await redis.set(`idemp:vigia-entrada:${ultimo.id}`, '1', 'EX', 2 * 86400, 'NX').catch(() => 'OK');
      if (primera !== 'OK') return false;
      const desde = obtenerFechaHoraLima(ultimo.creado_en).horaMinutos;
      const titulo = `WhatsApp no recibe mensajes hace ${Math.floor(sinEntrar)} min`;
      const mensaje = `Ningún cliente escribe desde las ${desde} con el local abierto. Si debería haber mensajes, el WhatsApp del bot puede estar recibiendo mal: pide reiniciar Evolution (acción «reiniciar-evolution»).`;
      const enlace = '/admin/mensajes';
      const notif = await this.prisma.notificacion.create({ data: { tipo: 'WHATSAPP_SIN_ENTRADA', rol_destino: 'ADMIN', titulo, mensaje, enlace } });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo, mensaje, enlace });
      this.logger.warn(`{"evento":"whatsapp_sin_entrada","minutos":${Math.floor(sinEntrar)}}`);
      return true;
    } finally {
      await liberarCandado(redis, 'lock:chatbot:vigia-entrada', candado.token).catch(() => {});
    }
  }
}
