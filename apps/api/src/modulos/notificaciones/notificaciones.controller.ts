import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { NotificacionesService } from './notificaciones.service';

// Cualquier usuario con sesión: el servicio filtra por el rol
@Controller('admin/notificaciones')
@UseGuards(AccesoGuard)
export class NotificacionesController {
  constructor(private readonly notificaciones: NotificacionesService) {}

  @Get()
  resumen(@Req() req: any) {
    return this.notificaciones.resumen(req.usuario);
  }
}
