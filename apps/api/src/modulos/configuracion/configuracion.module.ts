import { Module } from '@nestjs/common';
import { ConfiguracionController } from './configuracion.controller';
import { ConfiguracionService } from './configuracion.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Module({
  controllers: [ConfiguracionController],
  providers: [ConfiguracionService, PrismaService, AuditoriaService],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
