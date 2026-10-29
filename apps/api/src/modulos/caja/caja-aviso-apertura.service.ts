import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { LocalService } from '../local/local.service';
import { obtenerFechaHoraLima } from '../local/local.util';

export const TIPO_CAJA_CERRADA_APERTURA = 'CAJA_CERRADA_APERTURA';
const CLAVE_CANDADO = 'lock:caja:aviso-apertura';
const INTERVALO_MS = 60_000;
const ESPERA_POR_DEFECTO_MIN = 15;

const aMinutos = (hora: string): number => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Avisa a Caja (campana, una vez por día) cuando el local ya abrió hace N minutos y la caja de hoy
 * todavía no existe. Respeta el horario del local (días cerrados, feriados y pausa incluidos).
 */
@Injectable()
export class CajaAvisoAperturaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CajaAvisoAperturaService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly local: LocalService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  onModuleInit() {
    // ponytail: un temporizador por instancia; el candado Redis evita avisos duplicados entre instancias
    this.timer = setInterval(() => {
      this.ciclo().catch((err) => this.logger.error(`Aviso de caja sin abrir: ${err.message}`, err.stack));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async ciclo(): Promise<boolean> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), CLAVE_CANDADO, INTERVALO_MS - 5000);
    if (!candado.adquirido) return false;
    return this.avisarSiSinAbrir(new Date());
  }

  /** Crea la notificación si corresponde. Devuelve true solo cuando la crea. */
  async avisarSiSinAbrir(ahora: Date): Promise<boolean> {
    const { fechaIso, horaMinutos } = obtenerFechaHoraLima(ahora);

    const param = await this.prisma.parametro.findUnique({ where: { clave: 'caja_aviso_apertura_min' } });
    const esperaMin = Number.isFinite(Number(param?.valor)) ? Number(param?.valor) : ESPERA_POR_DEFECTO_MIN;

    // Pausa, día cerrado o feriado: el estado de la carta no trae hora de apertura
    const estado = await this.local.obtenerEstadoCarta(ahora);
    if (!estado.abre || !estado.cierra) return false;
    const ahoraMin = aMinutos(horaMinutos);
    if (ahoraMin < aMinutos(estado.abre) + esperaMin || ahoraMin >= aMinutos(estado.cierra)) return false;

    // Si ya hay caja de hoy (abierta o cerrada), no está «sin abrir»
    const cajaHoy = await this.prisma.caja.findUnique({
      where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) },
      select: { id: true },
    });
    if (cajaHoy) return false;

    // Una sola vez por día Lima (Lima no tiene horario de verano: -05:00 fijo)
    const inicioDia = new Date(`${fechaIso}T00:00:00.000-05:00`);
    const yaAvisado = await this.prisma.notificacion.findFirst({
      where: { tipo: TIPO_CAJA_CERRADA_APERTURA, en: { gte: inicioDia } },
      select: { id: true },
    });
    if (yaAvisado) return false;

    const notif = await this.prisma.notificacion.create({
      data: {
        tipo: TIPO_CAJA_CERRADA_APERTURA,
        rol_destino: 'CAJERO',
        titulo: 'Caja sin abrir',
        mensaje: `El local ya abrió a las ${estado.abre} y la caja de hoy todavía no está abierta. Ábrela para cobrar y aprobar pagos.`,
        enlace: '/admin/caja',
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });
    return true;
  }
}
