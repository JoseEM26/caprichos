import { Module } from '@nestjs/common';
import { ReclamosService } from './reclamos.service';
import { ReclamosPublicoController } from './reclamos.publico.controller';
import { ReclamosAdminController } from './reclamos.admin.controller';
import { TextosLegalesAdminController } from './textos-legales-admin.controller';
import { TextosLegalesService } from './textos-legales.service';

@Module({
  controllers: [ReclamosPublicoController, ReclamosAdminController, TextosLegalesAdminController],
  providers: [ReclamosService, TextosLegalesService],
  exports: [ReclamosService],
})
export class ReclamosModule {}
