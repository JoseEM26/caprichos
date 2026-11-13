import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado } from '../../comun/redis/candado.util';
import { AsistenciaTurnosService } from './asistencia-turnos.service';

const REVISION_MS = 5 * 60_000;
/** El candado dura casi lo que el intervalo: con varias instancias solo una corre cada vuelta. */
const CANDADO_MS = REVISION_MS - 30_000;

/**
 * Cada 5 minutos: vence los pedidos de turno que no se aprobaron antes de empezar y marca SIN_MARCA los reemplazos
 * aprobados que no marcaron pasada la tolerancia. Idempotente (cada cambio es condicional al estado anterior).
 * ponytail: revisión por intervalo + candado Redis, igual que la limpieza de selfies.
 */
@Injectable()
export class AsistenciaTurnosTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsistenciaTurnosTarea.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly redis: RedisService, private readonly turnos: AsistenciaTurnosService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.revisar().catch((e) => this.logger.error(`Revisión de turnos: ${e?.message ?? e}`));
    }, REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async revisar(ahora = new Date()): Promise<{ ejecutada: boolean; vencidas?: number; sinMarca?: number }> {
    const candado = await adquirirCandado(this.redis.obtenerCliente(), 'lock:asistencia:turnos', CANDADO_MS);
    if (!candado.adquirido) return { ejecutada: false };
    const r = await this.turnos.procesarVencimientos(ahora);
    if (r.vencidas || r.sinMarca) this.logger.log(`Turnos: ${r.vencidas} vencida(s), ${r.sinMarca} sin marca`);
    return { ejecutada: true, ...r };
  }
}
