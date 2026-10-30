import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EncuestasEstadisticaService } from './encuestas-estadistica.service';
import { FiltroEncuestasDto } from './dto/filtro-encuestas.dto';

@Controller('admin/estadisticas')
@UseGuards(AccesoGuard)
export class EncuestasEstadisticaController {
  constructor(private readonly encuestas: EncuestasEstadisticaService) {}

  /** Encuesta posventa por WhatsApp: resumen, distribución, tendencia y lista paginada. */
  @Get('encuestas')
  @Permiso('auditoria', 'ver')
  obtenerEncuestas(@Query() filtro: FiltroEncuestasDto) {
    return this.encuestas.obtenerEstadisticas(filtro);
  }
}
