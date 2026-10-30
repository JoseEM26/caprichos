import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis, { RedisOptions } from 'ioredis';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;
  private conectado = false;

  constructor(private readonly nestApp: INestApplicationContext) {
    super(nestApp);
  }

  /**
   * Conecta clientes pub/sub a Redis y configura el adaptador de Socket.IO.
   * Si Redis no está disponible, atrapa el error y continúa con el adaptador en memoria.
   */
  async conectarRedis(): Promise<void> {
    try {
      const configService = this.nestApp.get(ConfigService);
      const redisUrl = configService.get<string>('REDIS_URL');
      const host = configService.get<string>('REDIS_HOST', 'localhost');
      const port = Number(configService.get<number>('REDIS_PORT', 6379));

      const redisOpts: RedisOptions = {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      };

      if (redisUrl) {
        this.pubClient = new Redis(redisUrl, redisOpts);
      } else {
        this.pubClient = new Redis({
          host,
          port,
          ...redisOpts,
        });
      }

      this.subClient = this.pubClient.duplicate();

      this.pubClient.on('error', (err) => {
        this.logger.warn(`Aviso de conexión Redis (pubClient Socket.IO): ${err.message}`);
      });
      this.subClient.on('error', (err) => {
        this.logger.warn(`Aviso de conexión Redis (subClient Socket.IO): ${err.message}`);
      });

      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
      this.conectado = true;
      this.logger.log('Adaptador de Redis para Socket.IO conectado exitosamente');
    } catch (err: any) {
      this.conectado = false;
      this.logger.warn(
        `No se pudo conectar a Redis para Socket.IO (${err?.message || err}). Usando adaptador en memoria por fallback.`,
      );
    }
  }

  override createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    if (this.conectado && this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  async cerrar(): Promise<void> {
    if (this.pubClient) {
      try {
        await this.pubClient.quit();
      } catch {
        this.pubClient.disconnect();
      }
    }
    if (this.subClient) {
      try {
        await this.subClient.quit();
      } catch {
        this.subClient.disconnect();
      }
    }
  }

  estaConectado(): boolean {
    return this.conectado;
  }
}
