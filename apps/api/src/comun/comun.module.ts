import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { EventosGateway } from './socket/eventos.gateway';

// Una sola conexión a la base y a Redis, y un solo servidor de tiempo real, para toda la API
@Global()
@Module({
  providers: [PrismaService, RedisService, EventosGateway],
  exports: [PrismaService, RedisService, EventosGateway],
})
export class ComunModule {}
