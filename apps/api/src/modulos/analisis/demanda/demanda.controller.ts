import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { DemandaService } from './demanda.service';

/** Análisis › Demanda. Solo ADMIN y SUPERVISOR (permiso analisis/ver). No lleva dinero. */
@Controller('admin/analisis/demanda')
@UseGuards(AccesoGuard)
export class DemandaController {
  constructor(private readonly demanda: DemandaService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string; turno?: string }) {
    return this.demanda.resumen(q);
  }

  /** Carga de cocina ahora (no depende de fechas). */
  @Get('vivo')
  @Permiso('analisis', 'ver')
  vivo() {
    return this.demanda.vivo();
  }
}
