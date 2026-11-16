import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { AvisosManualesService } from '../servicios/avisos-manuales.service';

/** Avisos del pedido que no salieron solos y una persona puede enviar desde Mensajes (Caja, Pedidos y Mis pedidos del mozo). */
@Controller(['admin/whatsapp', 'api/admin/whatsapp'])
@UseGuards(AccesoGuard)
export class AvisosManualesController {
  constructor(private readonly avisos: AvisosManualesService) {}

  @Get('avisos-pedido-pendientes')
  @Permiso([
    { modulo: 'pedidos', accion: 'ver' },
    { modulo: 'pedidos', accion: 'crear' },
  ])
  pendientes(@Query('ids') ids?: string) {
    return this.avisos.pendientes(String(ids ?? '').split(',').map((i) => i.trim()));
  }
}
