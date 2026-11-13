import { Module } from '@nestjs/common';
import { FeriadosController } from './feriados.controller';
import { FeriadosService } from './feriados.service';
import { ArchivosModule } from '../archivos/archivos.module';
import { VacacionesService } from './vacaciones.service';
import { VinculoController } from './vinculo.controller';
import { AsistenciaAdminController } from './asistencia-admin.controller';
import { AsistenciaCalendarioService } from './asistencia-calendario.service';
import { AsistenciaController, MiAsistenciaController } from './asistencia.controller';
import { AsistenciaPantallaPublicaController } from './asistencia-pantalla.controller';
import { MiPlanillaController, PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { PrestamosService } from './prestamos.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';
import { AsistenciaTurnosService } from './asistencia-turnos.service';
import { AsistenciaTurnosTarea } from './asistencia-turnos.tarea';
import { MisTurnosController, TurnosAprobacionController } from './asistencia-turnos.controller';

@Module({
  imports: [ArchivosModule],
  controllers: [AsistenciaController, MiAsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, PlanillaController, MiPlanillaController, FeriadosController, VinculoController, MisTurnosController, TurnosAprobacionController],
  providers: [AsistenciaService, AsistenciaCalendarioService, AsistenciaCorreccionesService, PlanillaService, PrestamosService, FeriadosService, VacacionesService, AsistenciaSelfiesTarea, AsistenciaTurnosService, AsistenciaTurnosTarea],
  exports: [AsistenciaService, AsistenciaCorreccionesService, PlanillaService, VacacionesService],
})
export class AsistenciaModule {}
