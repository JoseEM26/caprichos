import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { horaLimaEntera } from '../../comun/fechas-lima';
import { AprendizajesNocheService } from './aprendizajes-noche.service';

const INTERVALO_MS = 10 * 60_000;

/**
 * Sondeo cada 10 min: desde la hora del parámetro (Lima) y si la noche de ayer aún no existe, la procesa.
 * Los reintentos de una noche en ERROR son manuales (ejecutar-ahora) para no gastar IA en bucle.
 */
@Injectable()
export class AprendizajesTarea implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AprendizajesTarea.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService, private readonly noche: AprendizajesNocheService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      this.ciclo().catch((e) => this.logger.error(`Aprendizaje nocturno: ${e?.message}`, e?.stack));
    }, INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async ciclo(ahora: Date = new Date()): Promise<'apagado' | 'temprano' | 'ya_hecho' | 'ejecutado'> {
    const par = await this.noche.parametros();
    if (!par.activo) return 'apagado';
    if (horaLimaEntera(ahora) < par.hora) return 'temprano';
    const fecha = this.noche.ayer(ahora);
    const existe = await this.prisma.aprendizajeNoche.findUnique({ where: { fecha: new Date(`${fecha}T00:00:00.000Z`) }, select: { id: true } });
    if (existe) return 'ya_hecho';
    await this.noche.ejecutarNoche(fecha);
    return 'ejecutado';
  }
}
