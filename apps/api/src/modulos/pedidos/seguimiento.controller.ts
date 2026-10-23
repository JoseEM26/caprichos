import { Controller, Get, Param, Query } from '@nestjs/common';
import { SeguimientoService } from './seguimiento.service';

/**
 * Seguimiento público del pedido para el invitado de la carta (sin sesión).
 * El acceso lo da el token `t`, no el código del pedido.
 */
@Controller('carta')
export class SeguimientoController {
  constructor(private readonly seguimientoService: SeguimientoService) {}

  @Get('seguimiento/:codigo')
  async obtener(@Param('codigo') codigo: string, @Query('t') token?: string) {
    return this.seguimientoService.obtener(codigo, token);
  }
}
