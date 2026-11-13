import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AprendizajesMejorarService } from './aprendizajes-mejorar.service';
import { AprendizajesService, EdicionAprobar } from './aprendizajes.service';

/** Bot que aprende. Solo ADMIN (permisos aprendizajes/ver y aprendizajes/aprobar). */
@Controller('admin/aprendizajes')
@UseGuards(AccesoGuard)
export class AprendizajesController {
  constructor(private readonly servicio: AprendizajesService, private readonly mejorador: AprendizajesMejorarService) {}

  @Get()
  @Permiso('aprendizajes', 'ver')
  listar(@Query() q: { estado?: string; pagina?: string; limite?: string }) {
    return this.servicio.listar(q);
  }

  @Get('conocimiento')
  @Permiso('aprendizajes', 'ver')
  conocimiento() {
    return this.servicio.conocimientoVigente();
  }

  @Get('resumen')
  @Permiso('aprendizajes', 'ver')
  resumen() {
    return this.servicio.resumen();
  }

  /** Reescribe la respuesta con la voz de Capri. No guarda nada. */
  @Post('mejorar')
  @Permiso('aprendizajes', 'aprobar')
  mejorar(@Body() body: { pregunta?: string; respuesta?: string; intencion?: string; tipo?: string }, @Req() req: any) {
    return this.mejorador.mejorar(body, req.usuario.partyId);
  }

  @Post('ejecutar-ahora')
  @Permiso('aprendizajes', 'aprobar')
  ejecutarAhora() {
    return this.servicio.ejecutarAhora();
  }

  @Post('ejecutar-historico')
  @Permiso('aprendizajes', 'aprobar')
  ejecutarHistorico() {
    return this.servicio.ejecutarHistorico();
  }

  @Post('conocimiento/:id/retirar')
  @Permiso('aprendizajes', 'aprobar')
  retirar(@Param('id') id: string, @Body() body: { motivo?: string }, @Req() req: any) {
    return this.servicio.retirar(id, body?.motivo, req.usuario.partyId, req.ip);
  }

  @Post(':id/aprobar')
  @Permiso('aprendizajes', 'aprobar')
  aprobar(@Param('id') id: string, @Body() body: EdicionAprobar, @Req() req: any) {
    return this.servicio.aprobar(id, body, req.usuario.partyId, req.ip);
  }

  @Post(':id/descartar')
  @Permiso('aprendizajes', 'aprobar')
  descartar(@Param('id') id: string, @Body() body: { motivo?: string }, @Req() req: any) {
    return this.servicio.descartar(id, body?.motivo, req.usuario.partyId, req.ip);
  }
}
