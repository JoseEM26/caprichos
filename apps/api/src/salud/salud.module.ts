import { Module } from '@nestjs/common';
import { SaludController } from './salud.controller';
import { SaludService } from './salud.service';
import { PrismaService } from '../comun/prisma/prisma.service';
import { RedisService } from '../comun/redis/redis.service';

@Module({
  controllers: [SaludController],
  providers: [SaludService, PrismaService, RedisService],
  exports: [SaludService],
})
export class SaludModule {}
