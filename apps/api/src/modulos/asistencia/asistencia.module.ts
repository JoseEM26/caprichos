import { Module } from '@nestjs/common';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';

@Module({
  controllers: [AsistenciaController, AsistenciaAdminController],
  providers: [AsistenciaService],
  exports: [AsistenciaService],
})
export class AsistenciaModule {}
