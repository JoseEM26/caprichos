import {
  Body,
  Controller,
  Delete,
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
import { CambiarMesaDto } from './dto/cambiar-mesa.dto';
import { AgregarMesasDto } from './dto/agregar-mesas.dto';

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

  /** GET /admin/salon/espera (mesas/ver): lista de espera de mesa, FIFO. */
  @Get('espera')
  @Permiso('mesas', 'ver')
  async listarEspera(@Req() req: any) {
    return this.salonService.listarEspera(req.usuario);
  }

  /** POST /admin/salon/espera/:pedidoId/asignar (mesas/abrir) { mesaId }: el pedido pasa a la mesa libre. */
  @Post('espera/:pedidoId/asignar')
  @Permiso('mesas', 'abrir')
  async asignarEspera(@Param('pedidoId') pedidoId: string, @Body() dto: CambiarMesaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.asignarEspera(pedidoId, dto.mesaId, req.usuario, ip, dto.forzarOcupada === true);
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
   * 5) POST /admin/salon/pedidos/:id/cambiar-mesa (mesas/abrir) { mesaId }
   * Mueve el pedido de mesa a una mesa libre (cualquier mozo, caja o supervisor con mesas/abrir).
   */
  @Post('pedidos/:id/cambiar-mesa')
  @Permiso('mesas', 'abrir')
  async cambiarMesa(@Param('id') id: string, @Body() dto: CambiarMesaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.cambiarMesaPedido(id, dto.mesaId, req.usuario, ip, dto.desdeMesaId);
  }

  /**
   * 8) POST /admin/salon/pedidos/:id/mesas (mesas/abrir) { mesaIds }
   * Suma mesas juntas a un pedido de salón abierto (máximo 6 en total).
   */
  @Post('pedidos/:id/mesas')
  @Permiso('mesas', 'abrir')
  async agregarMesas(@Param('id') id: string, @Body() dto: AgregarMesasDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.agregarMesasPedido(id, dto.mesaIds, req.usuario, ip);
  }

  /**
   * 9) DELETE /admin/salon/pedidos/:id/mesas/:mesaId (mesas/abrir)
   * Quita una mesa del pedido; la mesa queda libre. El pedido conserva al menos una.
   */
  @Delete('pedidos/:id/mesas/:mesaId')
  @Permiso('mesas', 'abrir')
  async quitarMesa(@Param('id') id: string, @Param('mesaId') mesaId: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.salonService.quitarMesaPedido(id, mesaId, req.usuario, ip);
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
