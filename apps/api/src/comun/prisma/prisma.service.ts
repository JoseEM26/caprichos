import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Conexión a PostgreSQL establecida correctamente');
    } catch (error: any) {
      this.logger.warn(`No se pudo conectar inmediatamente a PostgreSQL: ${error?.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async verificarConexion(): Promise<{ conectado: boolean; mensaje?: string }> {
    try {
      await this.$queryRaw`SELECT 1`;
      return { conectado: true };
    } catch (error: any) {
      return {
        conectado: false,
        mensaje: error?.message || 'Fallo de conexión a PostgreSQL',
      };
    }
  }
}
