import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ComprasService } from './compras.service';
import { CrearProveedorDto } from './dto/crear-proveedor.dto';
import { ActualizarProveedorDto } from './dto/actualizar-proveedor.dto';
import { CrearPedidoProveedorDto } from './dto/crear-pedido-proveedor.dto';
import { CrearCompraDto } from './dto/crear-compra.dto';
import { RecibirPedidoDto } from './dto/recibir-pedido.dto';
import { AnularCompraDto } from './dto/anular-compra.dto';
import { ComprasQueryDto } from './dto/compras-query.dto';

@Controller('admin/compras')
@UseGuards(AccesoGuard)
export class ComprasController {
  constructor(private readonly comprasService: ComprasService) {}

  @Get('resumen')
  @Permiso('compras', 'ver')
  async obtenerResumen() {
    return this.comprasService.obtenerResumen();
  }

  // --- Proveedores ---
  @Get('proveedores')
  @Permiso('proveedores', 'ver')
  async listarProveedores() {
    return this.comprasService.listarProveedores();
  }

  @Post('proveedores')
  @Permiso('proveedores', 'crear')
  async crearProveedor(@Body() dto: CrearProveedorDto, @Req() req: any) {
    return this.comprasService.crearProveedor(dto, req.usuario, req.ip);
  }

  @Put('proveedores/:id')
  @Permiso('proveedores', 'editar')
  async actualizarProveedor(
    @Param('id') id: string,
    @Body() dto: ActualizarProveedorDto,
    @Req() req: any,
  ) {
    return this.comprasService.actualizarProveedor(id, dto, req.usuario, req.ip);
  }

  @Post('proveedores/:id/desactivar')
  @Permiso('proveedores', 'desactivar')
  async desactivarProveedor(@Param('id') id: string, @Req() req: any) {
    return this.comprasService.cambiarEstadoProveedor(id, false, req.usuario, req.ip);
  }

  @Post('proveedores/:id/activar')
  @Permiso('proveedores', 'desactivar')
  async activarProveedor(@Param('id') id: string, @Req() req: any) {
    return this.comprasService.cambiarEstadoProveedor(id, true, req.usuario, req.ip);
  }

  @Get('proveedores/:id/historial')
  @Permiso('proveedores', 'ver')
  async obtenerHistorialProveedor(@Param('id') id: string) {
    return this.comprasService.obtenerHistorialProveedor(id);
  }

  // --- Pedidos a Proveedores (WhatsApp) ---
  @Get('insumos-para-pedir')
  @Permiso('pedidos_proveedor', 'ver')
  async listarInsumosParaPedir(
    @Query('incluirRegulares') incluirRegulares?: string,
  ) {
    const inc = incluirRegulares === 'true' || incluirRegulares === '1';
    return this.comprasService.listarInsumosParaPedir(inc);
  }

  @Post('pedidos-proveedor')
  @Permiso('pedidos_proveedor', 'crear')
  async crearPedidoProveedor(
    @Body() dto: CrearPedidoProveedorDto,
    @Req() req: any,
  ) {
    return this.comprasService.crearPedidoProveedor(dto, req.usuario, req.ip);
  }

  @Post('pedidos-proveedor/:id/anular')
  @Permiso('pedidos_proveedor', 'anular')
  async anularPedidoProveedor(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @Req() req: any,
  ) {
    return this.comprasService.anularPedidoProveedor(
      id,
      motivo || 'Anulado por usuario',
      req.usuario,
      req.ip,
    );
  }

  // --- Compras ---
  @Get()
  @Permiso('compras', 'ver')
  async listarCompras(@Query() query: ComprasQueryDto) {
    return this.comprasService.listarCompras(query);
  }

  @Post()
  @Permiso('compras', 'crear')
  async registrarCompra(@Body() dto: CrearCompraDto, @Req() req: any) {
    return this.comprasService.registrarCompra(dto, req.usuario, req.ip);
  }

  @Post('recibir-pedido/:pedidoId')
  @Permiso('compras', 'crear')
  async recibirPedidoProveedor(
    @Param('pedidoId') pedidoId: string,
    @Body() dto: RecibirPedidoDto,
    @Req() req: any,
  ) {
    return this.comprasService.recibirPedidoProveedor(
      pedidoId,
      dto,
      req.usuario,
      req.ip,
    );
  }

  @Post(':id/pagar')
  @Permiso('compras', 'pagar')
  async marcarPagada(@Param('id') id: string, @Req() req: any) {
    return this.comprasService.marcarPagada(id, req.usuario, req.ip);
  }

  @Post(':id/anular')
  @Permiso('compras', 'anular')
  async anularCompra(
    @Param('id') id: string,
    @Body() dto: AnularCompraDto,
    @Req() req: any,
  ) {
    return this.comprasService.anularCompra(id, dto, req.usuario, req.ip);
  }
}
