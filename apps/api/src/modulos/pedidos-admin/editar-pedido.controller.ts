import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EditarPedidoService } from './editar-pedido.service';
import { EditandoPedidoDto, EditarPedidoDto } from './dto/editar-pedido.dto';

/**
 * «Editar pedido» en Caja: productos y datos de un pedido sin cobrar. Permiso pedidos/editar (ADMIN, SUPERVISOR,
 * CAJERO y MOZO), sin código de supervisor; el mozo puede editar cualquier pedido, no solo los suyos.
 */
@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class EditarPedidoController {
  constructor(private readonly editar: EditarPedidoService) {}

  @Get(':id/editar')
  @Permiso('pedidos', 'editar')
  async obtener(@Param('id') id: string, @Req() req: any) {
    return this.editar.obtenerParaEditar(id, req.usuario);
  }

  @Post(':id/editar')
  @Permiso('pedidos', 'editar')
  async guardar(@Param('id') id: string, @Body() dto: EditarPedidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.editar.editar(id, dto, req.usuario, ip);
  }

  /** Aviso de presencia: «Ana está editando este pedido» (vale 2 minutos si no se repite). */
  @Post(':id/editando')
  @Permiso('pedidos', 'editar')
  async editando(@Param('id') id: string, @Body() dto: EditandoPedidoDto, @Req() req: any) {
    return this.editar.marcarEditando(id, dto.activo, req.usuario);
  }
}
