import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { IaConsumoService } from './ia-consumo.service';
import { ResumenConsumoIaMes } from './tipos-ia';

@Controller('admin/configuracion/ia-consumo')
@UseGuards(AccesoGuard)
export class IaConsumoController {
  constructor(private readonly iaConsumoService: IaConsumoService) {}

  /**
   * Endpoint de solo lectura para el panel de administración (Configuración del local > Parámetros).
   * Muestra el resumen de llamadas, tokens y costo acumulado del mes frente al tope.
   * Exige permiso configuracion/ver.
   */
  @Get()
  @Permiso('configuracion', 'ver')
  async obtenerConsumo(): Promise<ResumenConsumoIaMes> {
    return this.iaConsumoService.obtenerConsumoMes();
  }
}
