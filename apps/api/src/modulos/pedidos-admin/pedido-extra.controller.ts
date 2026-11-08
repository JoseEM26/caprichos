import { Body, Controller, Headers, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PedidoExtraService } from './pedido-extra.service';
import { ExtraPedidoDto } from './dto/extra-pedido.dto';

/** «Agregar extra» a un pedido ya hecho. Permiso pedidos/extra (ADMIN, SUPERVISOR, CAJERO y MOZO). */
@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class PedidoExtraController {
  constructor(private readonly extra: PedidoExtraService) {}

  @Post(':id/extra')
  @HttpCode(HttpStatus.CREATED)
  @Permiso('pedidos', 'extra')
  async crear(
    @Param('id') id: string,
    @Body() dto: ExtraPedidoDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.extra.crearExtra(id, dto, req.usuario, idempotencyKey, ip);
  }
}
