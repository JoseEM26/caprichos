import { Module } from '@nestjs/common';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  controllers: [AsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController],
  providers: [AsistenciaService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService],
})
export class AsistenciaModule {}
