import { Module } from '@nestjs/common';
import { CartaController, CatalogoController } from './catalogo.controller';
import { CatalogoService } from './catalogo.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [CartaController, CatalogoController],
  providers: [CatalogoService],
  exports: [CatalogoService],
})
export class CatalogoModule {}
