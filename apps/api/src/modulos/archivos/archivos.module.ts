import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ArchivosController } from './archivos.controller';
import { ArchivosService } from './archivos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [ConfigModule, AuditoriaModule],
  controllers: [ArchivosController],
  providers: [ArchivosService, PrismaService],
  exports: [ArchivosService],
})
export class ArchivosModule {}
