import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import * as crypto from 'crypto';
import { WhatsappWebhookService } from './whatsapp-webhook.service';

export const NOMBRE_COLA_WHATSAPP = 'whatsapp-webhooks';

export interface ResultadoEncolado {
  encolado: boolean;
  jobId?: string;
  enLinea?: boolean;
  [key: string]: any;
}

@Injectable()
export class ColaWebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ColaWebhookService.name);
  private cola: Queue | null = null;
  private worker: Worker | null = null;
  private redisClient: Redis | null = null;
  private workerRedisClient: Redis | null = null;
  private disponible = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => WhatsappWebhookService))
    private readonly webhookService?: WhatsappWebhookService,
  ) {
    this.inicializarConexiones();
  }

  /**
   * Inicializa conexiones dedicadas a Redis para BullMQ con maxRetriesPerRequest: null.
   * Sin registrar ni exponer contraseñas ni URLs completas en los logs.
   */
  private inicializarConexiones() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = Number(this.configService.get<number>('REDIS_PORT', 6379));

      const opciones = {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
        connectTimeout: 3000,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      };

      if (redisUrl) {
        this.redisClient = new Redis(redisUrl, opciones);
      } else {
        this.redisClient = new Redis({
          host,
          port,
          ...opciones,
        });
      }

      this.workerRedisClient = this.redisClient.duplicate({
        maxRetriesPerRequest: null,
      });

      this.redisClient.on('error', (err) => {
        this.logger.warn(`Aviso de conexión Redis en cola BullMQ: ${err.message}`);
        this.disponible = false;
      });

      this.redisClient.on('ready', () => {
        this.disponible = true;
      });

      this.workerRedisClient.on('error', (err) => {
        this.logger.warn(`Aviso de conexión Redis en worker BullMQ: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`No se pudo inicializar Redis para BullMQ: ${err.message}. Modo en línea activo.`);
      this.disponible = false;
    }
  }

  async onModuleInit() {
    try {
      if (this.redisClient && this.workerRedisClient) {
        // Conectar clientes lazy
        await Promise.all([
          this.redisClient.connect().catch(() => null),
          this.workerRedisClient.connect().catch(() => null),
        ]);

        this.cola = new Queue(NOMBRE_COLA_WHATSAPP, {
          connection: this.redisClient,
          defaultJobOptions: {
            attempts: 5,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              count: 1000,
              age: 24 * 3600,
            },
            removeOnFail: {
              count: 5000,
            },
          },
        });

        this.cola.on('error', (err) => {
          this.logger.warn(`Aviso de error en Queue '${NOMBRE_COLA_WHATSAPP}': ${err.message}`);
          this.disponible = false;
        });

        // Worker en el mismo proceso con concurrencia 5
        this.worker = new Worker(
          NOMBRE_COLA_WHATSAPP,
          async (job: Job) => {
            if (this.webhookService) {
              await this.webhookService.procesarPayload(job.data);
            }
          },
          {
            connection: this.workerRedisClient,
            concurrency: 5,
          },
        );

        this.worker.on('error', (err) => {
          this.logger.warn(`Aviso de error en Worker '${NOMBRE_COLA_WHATSAPP}': ${err.message}`);
        });

        this.worker.on('failed', (job, err) => {
          this.logger.error(
            `Fallo en procesamiento de webhook (job ${job?.id}, intento ${job?.attemptsMade}/5): ${err.message}`,
            err.stack,
          );
        });

        this.disponible = true;
        this.logger.log(`Cola BullMQ y Worker (${NOMBRE_COLA_WHATSAPP}, concurrencia: 5) listos.`);
      }
    } catch (err: any) {
      this.logger.warn(`Fallo al arrancar BullMQ: ${err.message}. Fallback en línea habilitado.`);
      this.disponible = false;
    }
  }

  /**
   * Calcula el sha256 del rawBody para deduplicar reintentos de Meta en BullMQ.
   */
  calcularJobId(rawBody: Buffer | string | any): string {
    const buf = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {}));
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  /**
   * Encola el webhook si la cola está disponible; de lo contrario procesa en línea inmediatamente.
   * Nunca pierde el mensaje.
   */
  async encolarOProcesar(rawBody: Buffer | string | any, body: any): Promise<ResultadoEncolado> {
    const jobId = this.calcularJobId(rawBody);

    if (this.cola && this.disponible) {
      try {
        await this.cola.add('procesar-webhook', body, {
          jobId,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600,
          },
          removeOnFail: {
            count: 5000,
          },
        });
        return { encolado: true, jobId };
      } catch (err: any) {
        this.logger.warn(
          `Error al encolar job ${jobId} en BullMQ (${err.message}). Procesando en línea por resiliencia.`,
        );
      }
    }

    // Fallback: procesar en línea de inmediato si Redis no está disponible o falló el enqueue
    if (this.webhookService) {
      const res = await this.webhookService.procesarPayload(body);
      return { encolado: false, enLinea: true, ...res };
    }

    return { encolado: false, enLinea: true };
  }

  async onModuleDestroy() {
    this.logger.log('Cerrando worker y cola BullMQ de webhooks de WhatsApp...');
    if (this.worker && typeof this.worker.close === 'function') {
      try {
        await this.worker.close();
      } catch (err: any) {
        this.logger.warn(`Error al cerrar worker de BullMQ: ${err.message}`);
      }
    }

    if (this.cola && typeof this.cola.close === 'function') {
      try {
        await this.cola.close();
      } catch (err: any) {
        this.logger.warn(`Error al cerrar cola de BullMQ: ${err.message}`);
      }
    }

    if (this.workerRedisClient) {
      try {
        await this.workerRedisClient.quit();
      } catch {
        this.workerRedisClient.disconnect();
      }
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
    }
  }

  /**
   * Métodos auxiliares para pruebas e inspección
   */
  estaDisponible(): boolean {
    return this.disponible;
  }

  obtenerCola(): Queue | null {
    return this.cola;
  }
}
