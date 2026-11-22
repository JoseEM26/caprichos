import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PantallaLocalService, RespuestaPantalla } from './pantalla-local.service';

/**
 * Pedidos del local con sesión y permiso de cocina. Ya NO es público: lleva nombres, productos y pagos.
 * La TV sin sesión lee lo mismo por /carta/tv/pedidos-local con su llave (vista PANTALLA_LOCAL).
 */
@Controller('admin/pantalla-local')
@UseGuards(AccesoGuard)
export class PantallaLocalController {
  constructor(private readonly servicio: PantallaLocalService) {}

  @Get('pedidos')
  @Permiso([{ modulo: 'cocina', accion: 'ver' }, { modulo: 'cocina', accion: 'despacho' }])
  @Header('Cache-Control', 'no-store')
  pedidos(): Promise<RespuestaPantalla> {
    return this.servicio.pedidos();
  }
}
