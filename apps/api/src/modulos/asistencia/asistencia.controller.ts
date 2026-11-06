import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { MarcarDto, MiHistorialDto } from './dto/asistencia.dto';
import { AsistenciaService } from './asistencia.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Lo que cualquier persona con horario ve y hace de su propia asistencia (celular). */
@Controller('admin/asistencia')
@UseGuards(AccesoGuard)
export class AsistenciaController {
  constructor(private readonly asistencia: AsistenciaService) {}

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

  @Post('marcar')
  @Permiso('asistencia', 'marcar')
  marcar(@Body() dto: MarcarDto, @Req() req: any) {
    return this.asistencia.marcar(dto, req.usuario, ipDe(req));
  }
}
