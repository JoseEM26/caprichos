import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PinoLoggerService } from './comun/logger/pino-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const pinoLogger = app.get(PinoLoggerService);
  app.useLogger(pinoLogger);
  app.enableCors();

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
