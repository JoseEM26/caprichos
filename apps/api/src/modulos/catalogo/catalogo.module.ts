import { Module } from '@nestjs/common';
import { CartaController, CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [CartaController, CatalogoController],
  providers: [CatalogoService, PrismaService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
