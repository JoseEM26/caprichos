import { Module } from '@nestjs/common';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  controllers: [AsistenciaController, AsistenciaAdminController],
  providers: [AsistenciaService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService],
})
export class AsistenciaModule {}
