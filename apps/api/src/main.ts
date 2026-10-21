import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PinoLoggerService } from './comun/logger/pino-logger.service';

// Los ids de la base son BigInt: salen como texto en el JSON
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () { return this.toString(); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true, credentials: true });

  const configService = app.get(ConfigService);
  const puerto = configService.get<number>('PORT', 3000);
  const ambiente = configService.get<string>('NODE_ENV', 'development');
  const version = configService.get<string>('APP_VERSION', '0.1.0');
  const commit = configService.get<string>('GIT_COMMIT', 'dev-local');

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
