import { Module } from '@nestjs/common';
import { FeriadosController } from './feriados.controller';
import { FeriadosService } from './feriados.service';
import { ArchivosModule } from '../archivos/archivos.module';
import { VacacionesService } from './vacaciones.service';
import { VinculoController } from './vinculo.controller';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaMarcaWebController, AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  imports: [ArchivosModule],
  controllers: [AsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, AsistenciaMarcaWebController, PlanillaController, FeriadosController, VinculoController],
  providers: [AsistenciaService, PlanillaService, FeriadosService, VacacionesService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService, PlanillaService, VacacionesService],
})
export class AsistenciaModule {}
