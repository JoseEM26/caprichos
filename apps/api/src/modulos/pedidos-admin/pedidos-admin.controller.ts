import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PedidosEstadoService } from './pedidos-estado.service';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { CocinaQueryDto } from './dto/cocina-query.dto';

@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class PedidosAdminController {
  constructor(private readonly pedidosEstadoService: PedidosEstadoService) {}

  @Get()
  @Permiso('pedidos', 'ver')
  async listar(@Query() filtros: FiltrarPedidosDto, @Req() req: any) {
    return this.pedidosEstadoService.listar(filtros, req.usuario);
  }

  @Get('cocina')
  @Permiso('pedidos', 'ver')
  async listarCocina(@Query() query: CocinaQueryDto, @Req() req: any) {
    return this.pedidosEstadoService.listarCocina(query.historial, req.usuario);
  }

  @Get(':id')
  @Permiso('pedidos', 'ver')
  async obtenerPorId(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.obtenerPorId(id, req.usuario, ip);
  }

  @Post(':id/estado')
  @Permiso('pedidos', 'cambiar_estado')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.cambiarEstado(
      id,
      dto,
      req.usuario,
      pinSupervisor,
      ip,
    );
  }

  @Post(':id/pago')
  @Permiso('pedidos', 'cambiar_estado')
  async registrarPago(
    @Param('id') id: string,
    @Body() dto: RegistrarPagoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pedidosEstadoService.registrarPago(id, dto, req.usuario, ip);
  }
}
