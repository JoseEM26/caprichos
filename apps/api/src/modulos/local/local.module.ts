import { Module } from '@nestjs/common';
import { LocalController } from './local.controller';
import { CartaLocalController } from './carta-local.controller';
import { LocalService } from './local.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Module({
  controllers: [CartaLocalController, LocalController],
  providers: [LocalService, PrismaService, AuditoriaService],
  exports: [LocalService],
})
export class LocalModule {}
