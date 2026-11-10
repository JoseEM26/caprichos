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
import { PlanillaController } from './planilla.controller';
import { PlanillaService } from './planilla.service';
import { PrestamosService } from './prestamos.service';
import { AsistenciaService } from './asistencia.service';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaSelfiesTarea } from './asistencia-selfies.tarea';

@Module({
  imports: [ArchivosModule],
  controllers: [AsistenciaController, MiAsistenciaController, AsistenciaAdminController, AsistenciaPantallaPublicaController, PlanillaController, FeriadosController, VinculoController],
  providers: [AsistenciaService, AsistenciaCalendarioService, AsistenciaCorreccionesService, PlanillaService, PrestamosService, FeriadosService, VacacionesService, AsistenciaSelfiesTarea],
  exports: [AsistenciaService, AsistenciaCorreccionesService, PlanillaService, VacacionesService],
})
export class AsistenciaModule {}
