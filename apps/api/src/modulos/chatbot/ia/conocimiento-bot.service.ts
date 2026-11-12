import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { CONOCIMIENTO_MAX_ITEMS, construirSeccionConocimiento } from './prompt-sistema';

const CACHE_MS = 60_000;

/** Lee el conocimiento VIGENTE aprobado por el ADMIN y arma la sección del prompt (con caché de 1 minuto). */
@Injectable()
export class ConocimientoBotService {
  private readonly logger = new Logger(ConocimientoBotService.name);
  private cache: { texto: string; hasta: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async seccionPrompt(): Promise<string> {
    if (this.cache && this.cache.hasta > Date.now()) return this.cache.texto;
    try {
      const items = await this.prisma.conocimientoBot.findMany({
        where: { estado: 'VIGENTE' },
        orderBy: { version: 'desc' },
        take: CONOCIMIENTO_MAX_ITEMS,
        select: { tipo: true, intencion: true, pregunta: true, respuesta: true, frases: true },
      });
      const texto = construirSeccionConocimiento(items);
      this.cache = { texto, hasta: Date.now() + CACHE_MS };
      return texto;
    } catch (err: any) {
      this.logger.warn(`No se pudo leer el conocimiento aprobado: ${err?.message}`);
      return '';
    }
  }

  /** Aprobar o retirar se nota enseguida. */
  olvidarCache() {
    this.cache = null;
  }
}
