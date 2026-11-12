import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { tieneRol } from '../../acceso/roles-usuario';
import { RepartoService } from './reparto.service';

type Req_ = { user?: { rol: string; roles?: string[] } };
const esAdmin = (req: Req_) => Boolean(req.user && tieneRol(req.user, 'ADMIN'));

/** Análisis › Reparto. ADMIN y SUPERVISOR; el detalle por repartidor solo lo recibe el ADMIN. */
@Controller('admin/analisis/reparto')
@UseGuards(AccesoGuard)
export class RepartoAnalisisController {
  constructor(private readonly reparto: RepartoService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; canal?: string; turno?: string }, @Req() req: Req_) {
    return this.reparto.resumen(q, esAdmin(req));
  }

  /** Efectivo por rendir: siempre «ahora». */
  @Get('por-rendir')
  @Permiso('analisis', 'ver')
  porRendir(@Req() req: Req_) {
    return this.reparto.porRendir(esAdmin(req));
  }
}
