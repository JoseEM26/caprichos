import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6379));

    const opcionesComunes = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null, // Evita reintentos continuos si Redis está caído
    };

    if (redisUrl) {
      this.client = new Redis(redisUrl, opcionesComunes);
    } else {
      this.client = new Redis({
        host,
        port,
        ...opcionesComunes,
      });
    }

    this.client.on('error', (err) => {
      this.logger.warn(`Aviso de conexión Redis: ${err.message}`);
    });
  }

  obtenerCliente(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  async verificarConexion(): Promise<{ conectado: boolean; mensaje?: string }> {
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect().catch(() => {});
      }
      const respuesta = await this.client.ping();
      if (respuesta === 'PONG') {
        return { conectado: true };
      }
      return { conectado: false, mensaje: `Respuesta de Redis inesperada: ${respuesta}` };
    } catch (error: any) {
      return {
        conectado: false,
        mensaje: error?.message || 'Fallo de conexión a Redis',
      };
    }
  }
}
