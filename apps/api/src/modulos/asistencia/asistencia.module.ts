import { Module } from '@nestjs/common';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaMarcaWebController, AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  controllers: [AsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, AsistenciaMarcaWebController, PlanillaController],
  providers: [AsistenciaService, PlanillaService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService, PlanillaService],
})
export class AsistenciaModule {}
