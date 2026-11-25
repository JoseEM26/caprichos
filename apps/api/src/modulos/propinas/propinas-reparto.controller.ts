import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ParticipacionDto } from './dto/propinas-reparto.dto';
import { PropinasRepartoService } from './propinas-reparto.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Reparto de propinas (solo ADMIN: propinas/repartir): historial del reparto mensual antiguo (solo lectura), vista por día y excepción por persona. */
@Controller('admin/propinas')
@UseGuards(AccesoGuard)
export class PropinasRepartoController {
  constructor(private readonly reparto: PropinasRepartoService) {}

  @Get('reparto/historial')
  @Permiso('propinas', 'repartir')
  historial() {
    return this.reparto.historial();
  }

  /** Reparto vigente del mes (si existe) y vista previa en vivo. */
  @Get('reparto/:anio/:mes')
  @Permiso('propinas', 'repartir')
  vista(@Param('anio') anio: string, @Param('mes') mes: string) {
    return this.reparto.vista(Number(anio), Number(mes));
  }

  /** Solo para ver: reparto por día del mes y si cada parte ya se pagó en planilla. */
  @Get('dias/:anio/:mes')
  @Permiso('propinas', 'repartir')
  dias(@Param('anio') anio: string, @Param('mes') mes: string) {
    return this.reparto.vistaDias(Number(anio), Number(mes));
  }

  /** Excepción por persona para participar en el reparto (null = según su rol). */
  @Put('participacion/:partyId')
  @Permiso('propinas', 'repartir')
  participacion(@Param('partyId') partyId: string, @Body() dto: ParticipacionDto, @Req() req: any) {
    return this.reparto.fijarParticipacion(Number(partyId), dto.participa ?? null, req.usuario, ipDe(req));
  }
}

/** «Mi asistencia»: cada persona ve solo su propia parte de los repartos aprobados o pagados. */
@Controller('admin/asistencia')
@UseGuards(AccesoGuard)
export class PropinasMiController {
  constructor(private readonly reparto: PropinasRepartoService) {}

  @Get('mi/propinas')
  @Permiso('asistencia', 'marcar')
  miPropinas(@Req() req: any) {
    return this.reparto.miPropinas(req.usuario.partyId);
  }
}
