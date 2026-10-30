import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { SalonService } from './salon.service';
import { AbrirPedidoMesaDto } from './dto/abrir-pedido-mesa.dto';
import { LiberarMesaDto } from './dto/liberar-mesa.dto';

@Controller('admin/salon')
@UseGuards(AccesoGuard)
export class SalonController {
  constructor(private readonly salonService: SalonService) {}

  /**
   * 1) GET /admin/salon/mesas (mesas/ver)
   * Lista todas las mesas activas por piso con su estado derivado (LIBRE u OCUPADA)
   * y aviso de reservas activas hoy.
   */
  @Get('mesas')
  @Permiso('mesas', 'ver')
  async obtenerMesas() {
    return this.salonService.obtenerMesas();
  }

  /**
   * 2) POST /admin/salon/pedidos (mesas/abrir)
   * Abre un pedido de modalidad MESA en una o varias mesas (RN-CAP-108).
   */
  @Post('pedidos')
  @Permiso('mesas', 'abrir')
  async abrirPedido(
    @Body() dto: AbrirPedidoMesaDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    const clave = idempotencyKey || xIdempotencyKey;
    return this.salonService.abrirPedido(dto, req.usuario, clave);
  }

  /**
   * 3) POST /admin/salon/mesas/:id/liberar (mesas/liberar)
   * Libera a mano la mesa con motivo obligatorio >= 5 caracteres.
   */
  @Post('mesas/:id/liberar')
  @Permiso('mesas', 'liberar')
  async liberarMesa(
    @Param('id') id: string,
    @Body() dto: LiberarMesaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.liberarMesaManual(id, dto, req.usuario, ip);
  }

  /**
   * 4) POST /admin/salon/pedidos/:id/entregado-mesa (mesas/abrir)
   * Marca la hora en que el pedido fue entregado en mesa (solo pedidos en LISTO).
   */
  @Post('pedidos/:id/entregado-mesa')
  @Permiso('mesas', 'abrir')
  async marcarEntregadoMesa(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.marcarEntregadoMesa(id, req.usuario, ip);
  }
}
