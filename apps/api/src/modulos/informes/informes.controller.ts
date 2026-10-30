import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { InformesService } from './informes.service';
import { FiltroInformeDto, FiltroMapaDto } from './dto/filtro-informe.dto';

@Controller('admin/informes')
@UseGuards(AccesoGuard)
export class InformesController {
  constructor(private readonly informesService: InformesService) {}

  @Get('resumen')
  @Permiso('auditoria', 'ver')
  obtenerResumen(@Query() filtro: FiltroInformeDto) {
    return this.informesService.obtenerResumen(filtro);
  }

  @Get('catalogo')
  @Permiso('auditoria', 'ver')
  obtenerCatalogo(@Query() filtro: FiltroInformeDto) {
    return this.informesService.obtenerCatalogo(filtro);
  }

  @Get('indicadores')
  @Permiso('auditoria', 'ver')
  obtenerIndicadores() {
    return this.informesService.obtenerIndicadores();
  }

  @Get('mapa')
  @Permiso('zonas', 'ver')
  obtenerMapaEntregas(@Query() filtro: FiltroMapaDto) {
    return this.informesService.obtenerMapaEntregas(filtro);
  }

  @Get(':id')
  @Permiso('auditoria', 'ver')
  obtenerDetalle(@Param('id') id: string, @Query() filtro: FiltroInformeDto) {
    return this.informesService.obtenerDetalle(id, filtro);
  }
}
