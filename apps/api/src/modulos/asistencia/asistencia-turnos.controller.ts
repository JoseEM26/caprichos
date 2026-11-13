import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AsistenciaTurnosService } from './asistencia-turnos.service';
import { AprobarTurnoDto, CandidatosTurnoDto, CrearTurnoDto, ListarTurnosDto, RechazarTurnoDto } from './dto/turnos.dto';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Mis reemplazos y cambios de turno: siempre la cuenta del token (nunca otro partyId). */
@Controller('admin/asistencia/mi/turnos')
@UseGuards(AccesoGuard)
export class MisTurnosController {
  constructor(private readonly turnos: AsistenciaTurnosService) {}

  @Get('candidatos')
  @Permiso('asistencia', 'marcar')
  candidatos(@Req() req: any, @Query() q: CandidatosTurnoDto) {
    return this.turnos.candidatos(req.usuario.partyId, q);
  }

  /** Cambio de turno: turnos de esa persona que yo podría cubrir a cambio. */
  @Get('candidatos/:partyId/turnos')
  @Permiso('asistencia', 'marcar')
  turnosDe(@Req() req: any, @Param('partyId', ParseIntPipe) partyId: number) {
    return this.turnos.turnosDeCandidato(req.usuario.partyId, BigInt(partyId));
  }

  @Get('solicitudes')
  @Permiso('asistencia', 'marcar')
  mias(@Req() req: any) {
    return this.turnos.mias(req.usuario.partyId);
  }

  @Post('solicitudes')
  @Permiso('asistencia', 'marcar')
  crear(@Body() dto: CrearTurnoDto, @Req() req: any) {
    return this.turnos.crear(dto, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/aceptar')
  @Permiso('asistencia', 'marcar')
  aceptar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.turnos.aceptar(id, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/rechazar')
  @Permiso('asistencia', 'marcar')
  rechazar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.turnos.rechazar(id, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/cancelar')
  @Permiso('asistencia', 'marcar')
  cancelar(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.turnos.cancelar(id, req.usuario, ipDe(req));
  }
}

/** Supervisión y Admin: aprobar o rechazar. */
@Controller('admin/asistencia/turnos')
@UseGuards(AccesoGuard)
export class TurnosAprobacionController {
  constructor(private readonly turnos: AsistenciaTurnosService) {}

  @Get('solicitudes')
  @Permiso('asistencia', 'aprobar_reemplazos')
  listar(@Query() q: ListarTurnosDto) {
    return this.turnos.paraAprobar(q.estado);
  }

  @Post('solicitudes/:id/aprobar')
  @Permiso('asistencia', 'aprobar_reemplazos')
  aprobar(@Param('id', ParseIntPipe) id: number, @Body() dto: AprobarTurnoDto, @Req() req: any) {
    return this.turnos.aprobar(id, dto?.nota, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/rechazar')
  @Permiso('asistencia', 'aprobar_reemplazos')
  rechazar(@Param('id', ParseIntPipe) id: number, @Body() dto: RechazarTurnoDto, @Req() req: any) {
    return this.turnos.rechazarAdmin(id, dto.motivo, req.usuario, ipDe(req));
  }
}
