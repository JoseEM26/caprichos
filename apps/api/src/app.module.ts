import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validarEntorno } from './config/entorno.validacion';
import { PinoLoggerService } from './comun/logger/pino-logger.service';
import { PrismaService } from './comun/prisma/prisma.service';
import { RedisService } from './comun/redis/redis.service';
import { EventosGateway } from './comun/socket/eventos.gateway';
import { SaludModule } from './salud/salud.module';
import { VersionModule } from './version/version.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarEntorno,
    }),
    SaludModule,
    VersionModule,
  ],
  providers: [
    PinoLoggerService,
    PrismaService,
    RedisService,
    EventosGateway,
  ],
  exports: [
    PinoLoggerService,
    PrismaService,
    RedisService,
    EventosGateway,
  ],
})
export class AppModule {}
