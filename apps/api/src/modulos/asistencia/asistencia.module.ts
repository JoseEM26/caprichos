import { Module } from '@nestjs/common';
import { FeriadosController } from './feriados.controller';
import { FeriadosService } from './feriados.service';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaMarcaWebController, AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  controllers: [AsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, AsistenciaMarcaWebController, PlanillaController, FeriadosController],
  providers: [AsistenciaService, PlanillaService, FeriadosService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService, PlanillaService],
})
export class AsistenciaModule {}
