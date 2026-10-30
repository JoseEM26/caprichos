import { NestFactory } from '@nestjs/core';
import { valorTrustProxy } from './comun/confianza-proxy';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PinoLoggerService } from './comun/logger/pino-logger.service';
import { RedisIoAdapter } from './comun/socket/redis-io.adapter';

// Los ids de la base son BigInt: salen como texto en el JSON
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () { return this.toString(); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  // Apagado ordenado: deja de aceptar peticiones, espera tareas en curso y cierra Prisma, Redis y colas
  app.enableShutdownHooks();

  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Adaptador de Redis para Socket.IO entre múltiples réplicas (fallback en memoria si Redis no está)
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.conectarRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const configService = app.get(ConfigService);
  const puerto = configService.get<number>('PORT', 3000);
  const ambiente = configService.get<string>('NODE_ENV', 'development');
  const version = configService.get<string>('APP_VERSION', '0.1.0');
  const commit = configService.get<string>('GIT_COMMIT', 'dev-local');

  // Configuración de trust proxy para proxy inverso (Caddy / Cloudflare)
  const trustProxy = configService.get<string>('TRUST_PROXY', '1');
  const valorProxy = valorTrustProxy(trustProxy);
  if (valorProxy !== undefined) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', valorProxy);
  }

  // Configuración de CORS estricto o por origen configurado
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  if (corsOrigin && corsOrigin !== '*') {
    const origenes = corsOrigin.split(',').map((o) => o.trim());
    app.enableCors({ origin: origenes, credentials: true });
  } else {
    app.enableCors({ origin: true, credentials: true });
  }

  await app.listen(puerto, '0.0.0.0');

  pinoLogger.log({
    mensaje: 'API Caprichos iniciada exitosamente',
    version,
    ambiente,
    commit,
    puerto,
  });
}

bootstrap().catch((error) => {
  console.error('Error al arrancar la API:', error);
  process.exit(1);
});
