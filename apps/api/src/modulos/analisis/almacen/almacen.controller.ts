import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { AlmacenAnalisisService } from './almacen.service';

/** Análisis › Almacén. ADMIN y SUPERVISOR (agregado por insumo o producto; no hay datos de personas). */
@Controller('admin/analisis/almacen')
@UseGuards(AccesoGuard)
export class AlmacenAnalisisController {
  constructor(private readonly almacen: AlmacenAnalisisService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string }) {
    return this.almacen.resumen(q);
  }
}
