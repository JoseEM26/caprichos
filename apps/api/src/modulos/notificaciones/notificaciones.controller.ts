import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CrearMensajeInternoDto, FiltroHistorialDto, MarcarClaveDto, MarcarLeidaDto, MarcarTodasDto } from './dto/notificaciones.dto';
import { NotificacionesService } from './notificaciones.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

@Controller('admin/notificaciones')
@UseGuards(AccesoGuard)
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  resumen(@Req() req: any) {
    return this.notificaciones.resumen(req.usuario);
  }

  @Get('historial')
  @Permiso('notificaciones', 'ver')
  historial(@Query() filtro: FiltroHistorialDto, @Req() req: any) {
    return this.notificaciones.historial(filtro, req.usuario);
  }

  /** Marca leída (o no leída) cualquier aviso, guardado o calculado, para el usuario que llama */
  @Post('marcar')
  @Permiso('notificaciones', 'marcar')
  marcarClave(@Body() dto: MarcarClaveDto, @Req() req: any) {
    return this.notificaciones.marcarClave(dto.clave, dto.leida ?? true, req.usuario);
  }

  @Post('marcar-todas')
  @Permiso('notificaciones', 'marcar')
  marcarTodas(@Body() dto: MarcarTodasDto, @Req() req: any) {
    return this.notificaciones.marcarTodasLeidas(req.usuario, dto.ids);
  }

  @Post('mensaje-interno')
  @Permiso('notificaciones', 'marcar')
  crearMensajeInterno(@Body() dto: CrearMensajeInternoDto, @Req() req: any) {
    return this.notificaciones.crearMensajeInterno(dto, req.usuario, ipDe(req));
  }

  @Post(':id/marcar')
  @Permiso('notificaciones', 'marcar')
  marcarLeida(@Param('id') id: string, @Body() dto: MarcarLeidaDto, @Req() req: any) {
    return this.notificaciones.marcarLeida(id, dto.leida ?? true, req.usuario);
  }
}
