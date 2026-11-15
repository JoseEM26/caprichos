import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { ProductosAnalisisService } from './productos.service';

/**
 * Análisis › Productos. ADMIN y SUPERVISOR entran (analisis/ver); el dinero (montos y márgenes) solo sale para ADMIN,
 * al SUPERVISOR le llegan unidades y conteos con los montos en null (igual que Ventas).
 */
@Controller('admin/analisis/productos')
@UseGuards(AccesoGuard)
export class ProductosAnalisisController {
  constructor(private readonly productos: ProductosAnalisisService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string; turno?: string }, @Req() req: { usuario?: { rol?: string; roles?: string[] } }) {
    const u = req.usuario;
    const esAdmin = !!u && (u.roles ?? [u.rol]).includes('ADMIN');
    return this.productos.resumen(q, esAdmin);
  }
}
