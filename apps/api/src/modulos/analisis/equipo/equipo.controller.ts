import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { tieneRol } from '../../acceso/roles-usuario';
import { EquipoService } from './equipo.service';

/** Análisis › Equipo. ADMIN y SUPERVISOR; el detalle por persona solo lo recibe el ADMIN. */
@Controller('admin/analisis/equipo')
@UseGuards(AccesoGuard)
export class EquipoController {
  constructor(private readonly equipo: EquipoService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string }, @Req() req: { user?: { rol: string; roles?: string[] } }) {
    return this.equipo.resumen(q, Boolean(req.user && tieneRol(req.user, 'ADMIN')));
  }

  /** Tablero de huecos: siempre «ahora», sin rango de fechas. */
  @Get('huecos')
  @Permiso('analisis', 'ver')
  huecos() {
    return this.equipo.huecos();
  }
}
