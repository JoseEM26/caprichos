import { Module } from '@nestjs/common';
import { FeriadosController } from './feriados.controller';
import { FeriadosService } from './feriados.service';
import { ArchivosModule } from '../archivos/archivos.module';
import { VacacionesService } from './vacaciones.service';
import { VinculoController } from './vinculo.controller';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaController } from './asistencia.controller';
import { AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  imports: [ArchivosModule],
  controllers: [AsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, PlanillaController, FeriadosController, VinculoController],
  providers: [AsistenciaService, AsistenciaCorreccionesService, PlanillaService, FeriadosService, VacacionesService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService, AsistenciaCorreccionesService, PlanillaService, VacacionesService],
})
export class AsistenciaModule {}
