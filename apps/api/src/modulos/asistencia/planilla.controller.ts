import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AjusteDto, AnularAjusteDto, ExtraDto, PagarPlanillaDto, PlanillaFechaDto, ReabrirPlanillaDto, SueldoDto } from './dto/planilla.dto';
import { jornadaDe } from './asistencia.calculo';
import { PlanillaService } from './planilla.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Planilla del personal: solo ADMIN (planilla/ver y planilla/administrar). Nunca mueve caja. */
@Controller('admin/planilla')
@UseGuards(AccesoGuard)
export class PlanillaController {
  constructor(private readonly planilla: PlanillaService) {}

  @Get()
  @Permiso('planilla', 'ver')
  listar(@Query() q: PlanillaFechaDto) {
    return this.planilla.listar(q.fecha);
  }

  @Get('persona/:partyId')
  @Permiso('planilla', 'ver')
  detalle(@Param('partyId') partyId: string, @Query() q: PlanillaFechaDto) {
    return this.planilla.detalle(Number(partyId), q.fecha ?? jornadaDe(new Date()).jornada, q.excluir ? q.excluir.split(',').filter(Boolean) : []);
  }

  @Get('persona/:partyId/historial')
  @Permiso('planilla', 'ver')
  historial(@Param('partyId') partyId: string) {
    return this.planilla.historial(Number(partyId));
  }

  @Get('sueldo/:partyId')
  @Permiso('planilla', 'ver')
  verSueldo(@Param('partyId') partyId: string) {
    return this.planilla.obtenerSueldo(Number(partyId));
  }

  @Put('sueldo/:partyId')
  @Permiso('planilla', 'administrar')
  sueldo(@Param('partyId') partyId: string, @Body() dto: SueldoDto, @Req() req: any) {
    return this.planilla.guardarSueldo(Number(partyId), dto, req.usuario, ipDe(req));
  }

  @Post('adelantos')
  @Permiso('planilla', 'administrar')
  adelanto(@Body() dto: AjusteDto, @Req() req: any) {
    return this.planilla.crearAjuste('ADELANTO', dto, req.usuario, ipDe(req));
  }

  @Post('descuentos')
  @Permiso('planilla', 'administrar')
  descuento(@Body() dto: AjusteDto, @Req() req: any) {
    return this.planilla.crearAjuste('DESCUENTO', dto, req.usuario, ipDe(req));
  }

  @Post('ajustes/:id/anular')
  @Permiso('planilla', 'administrar')
  anular(@Param('id') id: string, @Body() dto: AnularAjusteDto, @Req() req: any) {
    return this.planilla.anularAjuste(Number(id), dto.motivo, req.usuario, ipDe(req));
  }

  @Post('extras')
  @Permiso('planilla', 'administrar')
  extra(@Body() dto: ExtraDto, @Req() req: any) {
    return this.planilla.aprobarExtra(dto.partyId, dto.jornada, dto.aprobada, req.usuario, ipDe(req));
  }

  @Post('pagar')
  @Permiso('planilla', 'administrar')
  pagar(@Body() dto: PagarPlanillaDto, @Req() req: any) {
    return this.planilla.pagar(dto.partyId, dto.fecha, dto.excluirConsumoIds ?? [], req.usuario, ipDe(req));
  }

  @Post('periodos/:id/reabrir')
  @Permiso('planilla', 'administrar')
  reabrir(@Param('id') id: string, @Body() dto: ReabrirPlanillaDto, @Req() req: any) {
    return this.planilla.reabrir(Number(id), dto.motivo, req.usuario, ipDe(req));
  }
}
