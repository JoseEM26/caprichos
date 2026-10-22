import { Module } from '@nestjs/common';
import { ReclamosService } from './reclamos.service';
import { ReclamosPublicoController } from './reclamos.publico.controller';
import { ReclamosAdminController } from './reclamos.admin.controller';

@Module({
  controllers: [ReclamosPublicoController, ReclamosAdminController],
  providers: [ReclamosService],
  exports: [ReclamosService],
})
export class ReclamosModule {}
