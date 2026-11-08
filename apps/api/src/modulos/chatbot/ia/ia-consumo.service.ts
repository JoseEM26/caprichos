import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { RedisService } from '../../../comun/redis/redis.service';
import { EventosGateway } from '../../../comun/socket/eventos.gateway';
import { ConfigService } from '@nestjs/config';
import { calcularCostoEstimadoUsd } from './ia-precios.config';
import { ResumenConsumoIaMes } from './tipos-ia';
import { normalizarTelefono } from '../utilidades/enmascarar.util';

/** Defaults (x5 respecto al diseno anterior): el dueno priorizo un bot mas funcional sobre el costo. */
export const TOPE_MENSUAL_USD_DEFECTO = 100;
export const MAX_POR_HORA_DEFECTO = 50;

@Injectable()
export class IaConsumoService {
  private readonly logger = new Logger(IaConsumoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /**
   * Obtiene el valor del parámetro de configuración 'chatbot_ia_activo' ('si' | 'no', por defecto 'no').
   */
  async estaParametroIaActivo(): Promise<boolean> {
    try {
      const p = await this.prisma.parametro.findUnique({
        where: { clave: 'chatbot_ia_activo' },
      });
      if (!p || p.valor === null || p.valor === undefined) return false;
      const v = p.valor;
      return v === true || String(v).toLowerCase().trim() === 'si';
    } catch (err: any) {
      this.logger.error(`Error consultando chatbot_ia_activo: ${err.message}`);
      return false;
    }
  }

  /**
   * Conversación libre con IA ('chatbot_modo_libre'): por defecto 'si'; solo 'no' la apaga.
   * Solo tiene efecto con la IA encendida (chatbot_ia_activo).
   */
  async estaModoLibre(): Promise<boolean> {
    try {
      const p = await this.prisma.parametro.findUnique({ where: { clave: 'chatbot_modo_libre' } });
      if (!p || p.valor === null || p.valor === undefined) return true;
      return !(p.valor === false || String(p.valor).toLowerCase().trim() === 'no');
    } catch {
      return true;
    }
  }

  /**
   * Obtiene el valor del parámetro 'ayuda_ia_activo' (boolean, por defecto false).
   */
  async estaParametroAyudaIaActivo(): Promise<boolean> {
    try {
      const p = await this.prisma.parametro.findUnique({
        where: { clave: 'ayuda_ia_activo' },
      });
      if (!p || p.valor === null || p.valor === undefined) return false;
      const v = p.valor;
      return v === true || String(v).toLowerCase().trim() === 'true' || String(v).toLowerCase().trim() === 'si';
    } catch (err: any) {
      this.logger.error(`Error consultando ayuda_ia_activo: ${err.message}`);
      return false;
    }
  }

  /**
   * Obtiene el tope mensual configurado en USD (por defecto 100).
   */
  async obtenerTopeMensualUsd(): Promise<number> {
    try {
      const p = await this.prisma.parametro.findUnique({
        where: { clave: 'chatbot_ia_tope_mensual_usd' },
      });
      if (!p || p.valor === null || p.valor === undefined) return TOPE_MENSUAL_USD_DEFECTO;
      const n = Number(p.valor);
      return isNaN(n) || n <= 0 ? TOPE_MENSUAL_USD_DEFECTO : n;
    } catch {
      return TOPE_MENSUAL_USD_DEFECTO;
    }
  }

  /**
   * Obtiene el límite de consultas por hora por teléfono (por defecto 50).
   */
  async obtenerMaxPorHoraTelefono(): Promise<number> {
    try {
      const p = await this.prisma.parametro.findUnique({
        where: { clave: 'chatbot_ia_max_por_hora_telefono' },
      });
      if (!p || p.valor === null || p.valor === undefined) return MAX_POR_HORA_DEFECTO;
      const n = Number(p.valor);
      return isNaN(n) || n <= 0 ? MAX_POR_HORA_DEFECTO : n;
    } catch {
      return MAX_POR_HORA_DEFECTO;
    }
  }

  /**
   * Verifica si la IA se encuentra completamente operativa:
   * 1. chatbot_ia_activo == 'si'
   * 2. OPENAI_API_KEY configurada
   * 3. Tope mensual en USD no alcanzado
   */
  async puedeUsarIa(): Promise<{ permitido: boolean; motivo?: string }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '').trim();
    if (!apiKey) {
      return {
        permitido: false,
        motivo: 'Falta la clave de OpenAI (OPENAI_API_KEY no configurada). La IA permanece apagada.',
      };
    }

    const activo = await this.estaParametroIaActivo();
    if (!activo) {
      return {
        permitido: false,
        motivo: 'La IA para dudas está apagada por configuración (chatbot_ia_activo != "si").',
      };
    }

    // Sin Redis no hay control de consumo ni de límites: la IA se apaga y el bot usa respuestas fijas y botones
    if (!(await this.redisDisponible())) {
      return {
        permitido: false,
        motivo: 'Redis no responde: la IA está apagada temporalmente y el bot usa respuestas fijas.',
      };
    }

    const topeAlcanzado = await this.verificarTopeMensualAlcanzado();
    if (topeAlcanzado) {
      return {
        permitido: false,
        motivo: 'Se alcanzó el tope mensual de gasto en IA. La IA está apagada por el resto del mes.',
      };
    }

    return { permitido: true };
  }

  private redisCache: { ok: boolean; hastaMs: number } | null = null;
  private redisCaidoEpisodio = false;

  /**
   * Redis responde (PING con tope de 1,5 s). El resultado se cachea 10 s para no sumar latencia a cada consulta.
   * Nunca lanza. Avisa a administradores una vez al caer y otra al recuperarse.
   */
  async redisDisponible(): Promise<boolean> {
    if (this.redisCache && Date.now() < this.redisCache.hastaMs) return this.redisCache.ok;

    let ok = false;
    let timer: NodeJS.Timeout | undefined;
    try {
      const tope = new Promise<never>((_, rechazar) => {
        timer = setTimeout(() => rechazar(new Error('Redis sin respuesta')), 1500);
      });
      ok = (await Promise.race([this.redisService.obtenerCliente().ping(), tope])) === 'PONG';
    } catch {
      ok = false;
    } finally {
      if (timer) clearTimeout(timer);
    }

    this.redisCache = { ok, hastaMs: Date.now() + 10_000 };
    await this.registrarEpisodioRedis(ok);
    return ok;
  }

  private async registrarEpisodioRedis(ok: boolean): Promise<void> {
    if (!ok && !this.redisCaidoEpisodio) {
      this.redisCaidoEpisodio = true;
      this.logger.error('Redis no responde: la IA del bot queda apagada hasta que vuelva.');
      await this.avisarAdminsRedis(
        'REDIS_CAIDO',
        'IA del bot apagada: Redis no responde',
        'Mientras Redis no responda, el bot usa respuestas fijas y botones. La IA vuelve sola cuando Redis se recupere.',
      );
    } else if (ok && this.redisCaidoEpisodio) {
      this.redisCaidoEpisodio = false;
      this.logger.log('Redis recuperado: la IA del bot vuelve a estar disponible.');
      await this.avisarAdminsRedis(
        'REDIS_RECUPERADO',
        'Redis recuperado: IA del bot reactivada',
        'Redis responde otra vez. La IA del bot vuelve a estar disponible.',
      );
    }
  }

  private async avisarAdminsRedis(tipo: string, titulo: string, mensaje: string): Promise<void> {
    try {
      const notif = await this.prisma.notificacion.create({
        data: { tipo, rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/configuracion' },
      });
      this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err: any) {
      this.logger.warn(`No se pudo avisar a administradores del estado de Redis: ${err.message}`);
    }
  }

  /**
   * Verifica y controla el rate limit de preguntas a la IA por teléfono en una ventana de 1 hora.
   */
  async verificarRateLimitHora(telefono?: string | null): Promise<boolean> {
    if (!telefono) return true;
    const telNorm = normalizarTelefono(telefono) || telefono.trim();
    if (!telNorm) return true;

    try {
      const maxPorHora = await this.obtenerMaxPorHoraTelefono();
      const redis = this.redisService.obtenerCliente();
      const clave = `chatbot:ia:rate_hora:${telNorm}`;
      const consultas = await redis.incr(clave);
      if (consultas === 1) {
        await redis.expire(clave, 3600); // 1 hora
      }
      return consultas <= maxPorHora;
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para rate limit por hora de IA: ${err.message}`);
      return true;
    }
  }

  /**
   * Verifica si el gasto acumulado del mes superó el tope en dólares.
   * Si se alcanza, emite una notificación a Caja por la campana una sola vez en el mes.
   */
  async verificarTopeMensualAlcanzado(): Promise<boolean> {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    const topeUsd = await this.obtenerTopeMensualUsd();

    const agregados = await this.prisma.iaConsumo.aggregate({
      where: {
        fecha: { gte: inicioMes },
      },
      _sum: {
        costo_usd_estimado: true,
      },
    });

    const gastoMes = Number(agregados._sum.costo_usd_estimado || 0);

    if (gastoMes >= topeUsd) {
      await this.notificarTopeAlcanzadoUnaVez(gastoMes, topeUsd, ahora);
      return true;
    }

    return false;
  }

  /**
   * Notifica a la campana de Caja y Administradores UNA SOLA VEZ cuando se alcanza el tope del mes.
   */
  private async notificarTopeAlcanzadoUnaVez(
    gastoActual: number,
    tope: number,
    fecha: Date,
  ): Promise<void> {
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const claveRedis = `chatbot:ia:tope_notificado:${periodo}`;

    try {
      const redis = this.redisService.obtenerCliente();
      const yaNotificado = await redis.get(claveRedis);
      if (yaNotificado) {
        return; // Ya se avisó este mes
      }

      // Marcar hasta fin de mes (31 días = 2,678,400 s)
      await redis.set(claveRedis, '1', 'EX', 31 * 86400);
    } catch {
      // Si Redis falla, continuamos para asegurar la notificación
    }

    try {
      const titulo = 'Tope mensual de IA alcanzado';
      const mensaje = `El consumo acumulado de OpenAI ($${gastoActual.toFixed(2)} USD) alcanzó el tope mensual de $${tope.toFixed(2)} USD. La IA de dudas se apagó para el resto del mes.`;

      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'ATENCION_WHATSAPP',
          rol_destino: null, // Visible para Admin y Caja
          titulo,
          mensaje,
          enlace: '/admin/configuracion',
        },
      });

      this.eventos?.emitirAdmin('notificaciones:nueva', {
        id: notif.id.toString(),
        titulo,
      });

      this.logger.warn(`Tope de IA alcanzado ($${gastoActual.toFixed(2)} / $${tope} USD). Notificación ${notif.id} enviada a Caja.`);
    } catch (err: any) {
      this.logger.error(`Error emitiendo alerta de tope de IA: ${err.message}`);
    }
  }

  /**
   * Registra el consumo de una llamada a la IA en la tabla aditiva `ia_consumo`.
   */
  async registrarConsumo(datos: {
    conversacionId?: string | bigint | null;
    modelo: string;
    tokensEntrada: number;
    tokensSalida: number;
    herramientasUsadas?: string[];
    resultado: 'EXITO' | 'TOPE_EXCEDIDO' | 'ERROR' | 'DERIVADO_PERSONA' | 'INYECCION_BLOQUEADA';
    origen?: string;
  }): Promise<number> {
    const costoEstimado = calcularCostoEstimadoUsd(
      datos.modelo,
      datos.tokensEntrada,
      datos.tokensSalida,
    );

    const convId = datos.conversacionId
      ? typeof datos.conversacionId === 'bigint'
        ? datos.conversacionId
        : BigInt(datos.conversacionId)
      : null;

    try {
      await this.prisma.iaConsumo.create({
        data: {
          conversacion_id: convId,
          modelo: datos.modelo,
          tokens_entrada: datos.tokensEntrada,
          tokens_salida: datos.tokensSalida,
          costo_usd_estimado: costoEstimado,
          herramientas_usadas: datos.herramientasUsadas || [],
          resultado: datos.resultado,
          origen: datos.origen || 'CHATBOT',
        },
      });

      // Verificar si con este consumo se alcanzó el tope
      await this.verificarTopeMensualAlcanzado();
    } catch (err: any) {
      this.logger.error(`Error guardando registro en ia_consumo: ${err.message}`, err.stack);
    }

    return costoEstimado;
  }

  /**
   * Retorna las métricas de consumo del mes actual para la tarjeta del panel de Configuración.
   */
  async obtenerConsumoMes(fecha = new Date()): Promise<ResumenConsumoIaMes> {
    const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0);
    const periodo = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
    const topeUsd = await this.obtenerTopeMensualUsd();

    const agregados = await this.prisma.iaConsumo.aggregate({
      where: {
        fecha: { gte: inicioMes },
      },
      _count: {
        id: true,
      },
      _sum: {
        tokens_entrada: true,
        tokens_salida: true,
        costo_usd_estimado: true,
      },
    });

    const llamadasTotal = agregados._count.id || 0;
    const tokensEntrada = agregados._sum.tokens_entrada || 0;
    const tokensSalida = agregados._sum.tokens_salida || 0;
    const tokensTotal = tokensEntrada + tokensSalida;
    const costoUsdEstimado = Number(agregados._sum.costo_usd_estimado || 0);

    const porcentajeConsumido =
      topeUsd > 0 ? Math.min(100, Math.round((costoUsdEstimado / topeUsd) * 1000) / 10) : 0;
    const topeAlcanzado = costoUsdEstimado >= topeUsd;
    const activoParam = await this.estaParametroIaActivo();
    const iaActiva = activoParam && !topeAlcanzado;

    return {
      periodo,
      llamadasTotal,
      tokensEntrada,
      tokensSalida,
      tokensTotal,
      costoUsdEstimado: Math.round(costoUsdEstimado * 10000) / 10000,
      topeMensualUsd: topeUsd,
      porcentajeConsumido,
      topeAlcanzado,
      iaActiva,
    };
  }
}
