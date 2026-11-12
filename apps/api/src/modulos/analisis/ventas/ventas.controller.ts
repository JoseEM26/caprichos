import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { VentasService } from './ventas.service';

/**
 * Análisis › Ventas. ADMIN y SUPERVISOR entran (analisis/ver), pero el dinero solo sale para ADMIN:
 * al SUPERVISOR el servidor le devuelve conteos y unidades con los montos en null (igual que el escritorio).
 */
@Controller('admin/analisis/ventas')
@UseGuards(AccesoGuard)
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string; turno?: string }, @Req() req: { usuario?: { rol?: string; roles?: string[] } }) {
    const u = req.usuario;
    const esAdmin = !!u && (u.roles ?? [u.rol]).includes('ADMIN');
    return this.ventas.resumen(q, esAdmin);
  }
}
