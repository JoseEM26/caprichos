import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { adquirirCandado, liberarCandado } from '../../comun/redis/candado.util';
import { obtenerFechaHoraLima } from '../local/local.util';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AsistenciaService } from './asistencia.service';

/** Hora de Lima (24 h) a partir de la que corre la limpieza del día. Madrugada: el local está cerrado. */
export const HORA_LIMPIEZA_SELFIES = 3;
const REVISION_MS = 10 * 60_000;
const DIA_MS = 86_400_000;
const TAMANO_LOTE = 500;

export interface ResultadoLimpiezaSelfies {
  ejecutada: boolean;
  fotosBorradas?: number;
  motivo?: 'FUERA_DE_HORA' | 'YA_CORRIDA';
}

/**
 * Tarea diaria (03:00 Lima): borra la FOTO (asistencia_selfie) de las marcas con más de `retencion` días.
 * La marca no se toca. Idempotente: la corrida de cada día se marca con un candado Redis con la fecha,
 * así que con varias instancias o reinicios solo una la hace; si falla, el candado se libera y se reintenta.
 * Sin Redis (fallback) cada instancia podría correrla, pero borrar dos veces lo mismo no hace daño.
 * ponytail: revisión cada 10 min; con reloj y candado no hace falta cron del sistema.
 */
@Injectable()
export class AsistenciaSelfiesTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsistenciaSelfiesTarea.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly asistencia: AsistenciaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      this.revisar().catch((e) => this.logger.error(`Limpieza de selfies: ${e?.message ?? e}`));
    }, REVISION_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Una revisión: corre la limpieza si ya es la hora del día y hoy no se hizo. */
  async revisar(ahora = new Date()): Promise<ResultadoLimpiezaSelfies> {
    const { fechaIso, horaMinutos } = obtenerFechaHoraLima(ahora);
    if (Number(horaMinutos.split(':')[0]) < HORA_LIMPIEZA_SELFIES) return { ejecutada: false, motivo: 'FUERA_DE_HORA' };

    const clave = `lock:asistencia:selfies:${fechaIso}`;
    const cliente = this.redis.obtenerCliente();
    const candado = await adquirirCandado(cliente, clave, DIA_MS);
    if (!candado.adquirido) return { ejecutada: false, motivo: 'YA_CORRIDA' };

    try {
      const fotosBorradas = await this.limpiar(ahora);
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'asistencia',
        accion: 'LIMPIAR_SELFIES',
        resultado: 'OK',
        entidad: 'asistencia_selfie',
        despues: { fotosBorradas, fecha: fechaIso },
      });
      this.logger.log(`Limpieza de selfies ${fechaIso}: ${fotosBorradas} foto(s) borradas`);
      return { ejecutada: true, fotosBorradas };
    } catch (e) {
      // Falló a medias: se suelta el candado para que la próxima revisión lo reintente hoy
      if (!candado.fallback) await liberarCandado(cliente, clave, candado.token).catch(() => false);
      throw e;
    }
  }

  /** Borra en lotes las fotos de marcas más viejas que la retención (configurable). Solo asistencia_selfie. */
  async limpiar(ahora: Date): Promise<number> {
    const { retencionDias } = await this.asistencia.obtenerConfig();
    const corte = new Date(ahora.getTime() - retencionDias * DIA_MS);
    let total = 0;
    for (;;) {
      const lote = await this.prisma.asistenciaSelfie.findMany({
        where: { marca: { momento: { lt: corte } } },
        select: { marca_id: true },
        take: TAMANO_LOTE,
      });
      if (lote.length === 0) break;
      const r = await this.prisma.asistenciaSelfie.deleteMany({
        where: { marca_id: { in: lote.map((x) => x.marca_id) } },
      });
      if (r.count === 0) break;
      total += r.count;
    }
    return total;
  }
}
