import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { TiemposService } from './tiempos.service';

/** Análisis › Tiempos. Solo ADMIN y SUPERVISOR (permiso analisis/ver). Las metas se editan en Configuración (solo ADMIN). */
@Controller('admin/analisis/tiempos')
@UseGuards(AccesoGuard)
export class TiemposController {
  constructor(private readonly tiempos: TiemposService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string; turno?: string }) {
    return this.tiempos.resumen(q);
  }

  @Get('atascados')
  @Permiso('analisis', 'ver')
  atascados() {
    return this.tiempos.atascados();
  }
}
