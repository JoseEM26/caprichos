import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { sembrarTextosLegales } from './textos-legales';

/** Al arrancar deja los Términos y la Política base si el dueño aún no escribió los suyos. */
@Injectable()
export class TextosLegalesService implements OnModuleInit {
  private readonly logger = new Logger(TextosLegalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const r = await sembrarTextosLegales(this.prisma);
      if (r.sembrados.length) this.logger.log(`Textos legales base sembrados: ${r.sembrados.join(', ')}`);
    } catch (err: any) {
      this.logger.warn(`No se pudieron sembrar los textos legales: ${err.message}`);
    }
  }
}
