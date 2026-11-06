import { Body, Controller, Get, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AnularRepartoDto, ParticipacionDto, PagarRepartoDto } from './dto/propinas-reparto.dto';
import { PropinasRepartoService } from './propinas-reparto.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Reparto mensual de propinas (solo ADMIN: propinas/repartir). */
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

  @Post('reparto/:anio/:mes/calcular')
  @Permiso('propinas', 'repartir')
  calcular(@Param('anio') anio: string, @Param('mes') mes: string, @Req() req: any) {
    return this.reparto.calcular(Number(anio), Number(mes), req.usuario, ipDe(req));
  }

  @Post('reparto/:anio/:mes/aprobar')
  @Permiso('propinas', 'repartir')
  aprobar(@Param('anio') anio: string, @Param('mes') mes: string, @Req() req: any) {
    return this.reparto.aprobar(Number(anio), Number(mes), req.usuario, ipDe(req));
  }

  @Post('reparto/:anio/:mes/pagar')
  @Permiso('propinas', 'repartir')
  pagar(@Param('anio') anio: string, @Param('mes') mes: string, @Body() dto: PagarRepartoDto, @Req() req: any) {
    return this.reparto.pagar(Number(anio), Number(mes), dto, req.usuario, ipDe(req));
  }

  @Post('reparto/:anio/:mes/anular')
  @Permiso('propinas', 'repartir')
  anular(@Param('anio') anio: string, @Param('mes') mes: string, @Body() dto: AnularRepartoDto, @Req() req: any) {
    return this.reparto.anular(Number(anio), Number(mes), dto.motivo, req.usuario, ipDe(req));
  }

  @Get('reparto/:anio/:mes/csv')
  @Permiso('propinas', 'repartir')
  async csv(@Param('anio') anio: string, @Param('mes') mes: string, @Res({ passthrough: true }) res: Response) {
    const r = await this.reparto.csv(Number(anio), Number(mes));
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.nombre}"` });
    return r.csv;
  }

  /** Excepción por persona para participar en el reparto (null = según su rol). */
  @Put('participacion/:partyId')
  @Permiso('propinas', 'repartir')
  participacion(@Param('partyId') partyId: string, @Body() dto: ParticipacionDto, @Req() req: any) {
    return this.reparto.fijarParticipacion(Number(partyId), dto.participa ?? null, req.usuario, ipDe(req));
  }
}

/** «Mi asistencia»: cada persona ve solo su propia parte de los repartos aprobados o pagados. */
@Controller('asistencia')
@UseGuards(AccesoGuard)
export class PropinasMiController {
  constructor(private readonly reparto: PropinasRepartoService) {}

  @Get('mi/propinas')
  @Permiso('asistencia', 'marcar')
  miPropinas(@Req() req: any) {
    return this.reparto.miPropinas(req.usuario.partyId);
  }
}
