import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';

/** Lista cerrada de eventos que la carta puede enviar. PEDIDO lo pone solo el servidor (al crear el pedido). */
export const EVENTOS_CARTA = ['VISITA', 'CARRITO', 'CHECKOUT', 'PAGO'] as const;
export type EventoCarta = (typeof EVENTOS_CARTA)[number];
export const DISPOSITIVOS_CARTA = ['MOVIL', 'ESCRITORIO'] as const;

/** Retención: los eventos se borran pasados estos días. */
export const RETENCION_DIAS = 120;
/** Tope de eventos por minuto y por origen (la carta real manda 4 por visita). */
export const LIMITE_POR_MINUTO = 60;
const INTERVALO_LIMPIEZA_MS = 6 * 3600_000;
const SESION = /^[A-Za-z0-9_-]{8,40}$/;

export interface EventoEntrante {
  sesion?: unknown;
  evento?: unknown;
  dispositivo?: unknown;
  conSesion?: unknown;
}

/**
 * Registro anónimo de eventos de la carta. Guarda solo: id aleatorio de sesión del navegador, evento, tipo de dispositivo y
 * si había sesión. Nunca celular, nombre, IP ni user-agent. La IP solo sirve (con hash y 60 s de vida en Redis) para limitar el ritmo.
 */
@Injectable()
export class CartaEventosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CartaEventosService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.limpiar().catch((e) => this.logger.error(`Limpieza de eventos de la carta: ${e?.message ?? e}`));
    }, INTERVALO_LIMPIEZA_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Valida estrictamente (lista cerrada, sin texto libre). Devuelve null si algo no cuadra: se ignora sin error. */
  validar(b: EventoEntrante | null | undefined) {
    if (!b || typeof b !== 'object') return null;
    const evento = (EVENTOS_CARTA as readonly unknown[]).includes(b.evento) ? (b.evento as EventoCarta) : null;
    if (!evento) return null;
    const sesion = typeof b.sesion === 'string' && SESION.test(b.sesion) ? b.sesion : null;
    const dispositivo = (DISPOSITIVOS_CARTA as readonly unknown[]).includes(b.dispositivo) ? (b.dispositivo as string) : 'DESCONOCIDO';
    return { evento, sesion, dispositivo, conSesion: b.conSesion === true };
  }

  /** Ritmo por origen: si Redis no responde, se deja pasar (el registro es secundario). */
  async dentroDelLimite(ip: string | undefined): Promise<boolean> {
    try {
      const huella = createHash('sha256').update(ip ?? 'sin-ip').digest('hex').slice(0, 16);
      const clave = `rl:carta-eventos:${huella}`;
      const cliente = this.redis.obtenerCliente();
      const n = await cliente.incr(clave);
      if (n === 1) await cliente.expire(clave, 60);
      return n <= LIMITE_POR_MINUTO;
    } catch {
      return true;
    }
  }

  /** Atiende POST carta/eventos: nunca lanza (la carta no debe notar un fallo aquí). */
  async registrar(body: EventoEntrante | null | undefined, ip?: string): Promise<void> {
    try {
      const v = this.validar(body);
      if (!v) return;
      if (!(await this.dentroDelLimite(ip))) return;
      await this.prisma.cartaEvento.create({
        data: { sesion_id: v.sesion, evento: v.evento, dispositivo: v.dispositivo, con_sesion: v.conSesion },
      });
    } catch (e: any) {
      this.logger.warn(`Evento de carta no guardado: ${e?.message ?? e}`);
    }
  }

  /**
   * Enlaza el pedido creado con la sesión de la carta (cabecera opcional). Hereda dispositivo y «con sesión» del último evento
   * de esa sesión. Un pedido enlaza una vez (índice único): el reintento idempotente no duplica. Nunca lanza.
   */
  async enlazarPedido(pedidoId: string | bigint, sesion: unknown): Promise<void> {
    try {
      const s = typeof sesion === 'string' && SESION.test(sesion) ? sesion : null;
      const previo = s
        ? await this.prisma.cartaEvento.findFirst({ where: { sesion_id: s }, orderBy: { id: 'desc' }, select: { dispositivo: true, con_sesion: true } })
        : null;
      await this.prisma.cartaEvento.create({
        data: { sesion_id: s, evento: 'PEDIDO', dispositivo: previo?.dispositivo ?? 'DESCONOCIDO', con_sesion: previo?.con_sesion ?? false, pedido_id: BigInt(pedidoId) },
      });
    } catch (e: any) {
      // P2002 = ya enlazado (reintento idempotente): esperado
      if (e?.code !== 'P2002') this.logger.warn(`Pedido no enlazado a la sesión de la carta: ${e?.message ?? e}`);
    }
  }

  /** Borra los eventos con más de RETENCION_DIAS. Con candado para que solo una réplica lo haga. */
  async limpiar(ahora: Date = new Date()): Promise<number> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), 'lock:carta-eventos:limpieza', INTERVALO_LIMPIEZA_MS - 5000);
    if (!candado.adquirido) return 0;
    const corte = new Date(ahora.getTime() - RETENCION_DIAS * 86_400_000);
    const r = await this.prisma.cartaEvento.deleteMany({ where: { creado_en: { lt: corte } } });
    return r.count;
  }
}
