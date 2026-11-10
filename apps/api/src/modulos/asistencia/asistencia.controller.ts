import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CrearSolicitudDto, MarcarDto, MiHistorialDto } from './dto/asistencia.dto';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaService } from './asistencia.service';
import { PlanillaService } from './planilla.service';
import { VacacionesService } from './vacaciones.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Lo que cualquier persona con horario ve y hace de su propia asistencia (celular). */
@Controller('admin/asistencia')
@UseGuards(AccesoGuard)
export class AsistenciaController {
  constructor(
    private readonly asistencia: AsistenciaService,
    private readonly planilla: PlanillaService,
    private readonly vacaciones: VacacionesService,
    private readonly correcciones: AsistenciaCorreccionesService,
  ) {}

  @Get('mi/hoy')
  @Permiso('asistencia', 'marcar')
  miHoy(@Req() req: any) {
    return this.asistencia.miHoy(req.usuario.partyId);
  }

  @Get('mi/historial')
  @Permiso('asistencia', 'marcar')
  miHistorial(@Req() req: any, @Query() q: MiHistorialDto) {
    return this.asistencia.miHistorial(req.usuario.partyId, q.dias ?? 14);
  }

  /** Horas y tardanzas de mi período. Nunca lleva dinero. */
  @Get('mi/resumen')
  @Permiso('asistencia', 'marcar')
  miResumen(@Req() req: any) {
    return this.planilla.miResumen(req.usuario.partyId);
  }

  /** Lo que llevo ganado por día y acumulado del período actual (solo lo mío). */
  @Get('mi/ganado')
  @Permiso('asistencia', 'marcar')
  miGanado(@Req() req: any) {
    return this.planilla.miGanado(req.usuario.partyId);
  }

  /** Mi saldo de vacaciones (solo lectura; sin dinero). */
  @Get('mi/vacaciones')
  @Permiso('asistencia', 'marcar')
  miVacaciones(@Req() req: any) {
    return this.vacaciones.miVacaciones(req.usuario.partyId);
  }

  /** Mis jornadas con marcas que no cuadran (solo las mías): para corregirlas al día siguiente. */
  @Get('mi/inconsistencias')
  @Permiso('asistencia', 'marcar')
  miInconsistencias(@Req() req: any) {
    return this.correcciones.inconsistencias(req.usuario.partyId);
  }

  @Get('mi/solicitudes')
  @Permiso('asistencia', 'marcar')
  misSolicitudes(@Req() req: any) {
    return this.correcciones.misSolicitudes(req.usuario.partyId);
  }

  /** Pedir una corrección (no cuenta hasta que el administrador la apruebe). */
  @Post('mi/solicitudes')
  @Permiso('asistencia', 'marcar')
  crearSolicitud(@Body() dto: CrearSolicitudDto, @Req() req: any) {
    return this.correcciones.crearSolicitud(dto, req.usuario, ipDe(req));
  }

  @Post('mi/solicitudes/:id/cancelar')
  @Permiso('asistencia', 'marcar')
  cancelarSolicitud(@Param('id') id: string, @Req() req: any) {
    return this.correcciones.cancelarSolicitud(Number(id), req.usuario, ipDe(req));
  }

  @Post('marcar')
  @Permiso('asistencia', 'marcar')
  marcar(@Body() dto: MarcarDto, @Req() req: any) {
    return this.asistencia.marcar(dto, req.usuario, ipDe(req));
  }
}
