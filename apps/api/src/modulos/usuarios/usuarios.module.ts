import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, PrismaService, AuditoriaService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
