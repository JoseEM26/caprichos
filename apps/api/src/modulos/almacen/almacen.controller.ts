import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { AlmacenService } from './almacen.service';
import { MovimientoAlmacenDto } from './dto/movimiento-almacen.dto';
import { MermaMultipleDto } from './dto/merma-multiple.dto';
import { ProduccionTandasDto } from './dto/produccion-tandas.dto';
import { CierreDiaDto } from './dto/cierre-dia.dto';
import { AlmacenQueryDto } from './dto/almacen-query.dto';
import { CrearPedidoInternoDto } from './dto/crear-pedido-interno.dto';
import { RegistrarAperturaDto } from './dto/registrar-apertura.dto';
import { MermaProductoDto } from './dto/merma-producto.dto';


@Controller('admin/almacen')
@UseGuards(AccesoGuard)
export class AlmacenController {
  constructor(private readonly almacenService: AlmacenService) {}

  // --- Movimientos ---
  @Get('movimientos')
  @Permiso('almacen', 'ver')
  async listarMovimientos(@Query() query: AlmacenQueryDto) {
    return this.almacenService.listarMovimientos(query);
  }

  @Post('movimientos')
  @Permiso('almacen', 'movimientos')
  async registrarMovimiento(@Body() dto: MovimientoAlmacenDto, @Req() req: any) {
    return this.almacenService.registrarMovimiento(dto, req.usuario, req.ip);
  }

  @Post('movimientos-merma-multiple')
  @Permiso('almacen', 'movimientos')
  async mermaMultiple(@Body() dto: MermaMultipleDto, @Req() req: any) {
    return this.almacenService.mermaMultiple(dto, req.usuario, req.ip);
  }

  @Post('movimientos/:id/anular')
  @Permiso('almacen', 'movimientos')
  async anularMovimiento(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @Req() req: any,
  ) {
    return this.almacenService.anularMovimiento(
      id,
      motivo || 'Anulación por usuario',
      req.usuario,
      req.ip,
    );
  }

  // --- Conteo de apertura (productos que controlan stock) ---
  @Get('apertura')
  @Permiso('almacen', 'apertura')
  async obtenerApertura() {
    return this.almacenService.obtenerApertura();
  }

  /** Mermas de productos terminados de hoy (las que salen de Apertura), con su motivo. Se anulan con movimientos/:id/anular. */
  @Get('apertura/mermas')
  @Permiso('almacen', 'apertura')
  async mermasAperturaHoy() {
    return this.almacenService.listarMermasProductoHoy();
  }

  @Post('apertura')
  @Permiso('almacen', 'apertura')
  async registrarApertura(@Body() dto: RegistrarAperturaDto, @Req() req: any) {
    return this.almacenService.registrarApertura(dto, req.usuario, req.ip);
  }

  /** Merma de producto terminado (sabor o producto). Cocina la registra y queda auditada. */
  @Post('merma-producto')
  @Permiso('almacen', 'merma_producto')
  async mermaProducto(@Body() dto: MermaProductoDto, @Req() req: any) {
    return this.almacenService.registrarMermaProducto(dto, req.usuario, req.ip);
  }

  // --- Producción del día ---
  @Get('produccion/recetas')
  @Permiso('produccion', 'ver')
  async listarRecetasProduccion() {
    return this.almacenService.listarRecetasProduccion();
  }

  @Post('produccion')
  @Permiso('produccion', 'crear')
  async registrarProduccion(
    @Body() dto: ProduccionTandasDto,
    @Req() req: any,
  ) {
    return this.almacenService.registrarProduccion(dto, req.usuario, req.ip);
  }

  @Post('produccion/:id/anular')
  @Permiso('produccion', 'anular')
  async anularProduccion(
    @Param('id') id: string,
    @Body('motivo') motivo: string,
    @Req() req: any,
  ) {
    return this.almacenService.anularProduccion(
      id,
      motivo || 'Anulación de producción',
      req.usuario,
      req.ip,
    );
  }

  // --- Cierre del día con conteo ---
  @Get('cierre-dia/productos')
  @Permiso('almacen', 'cierre')
  async obtenerProductosDelDia() {
    return this.almacenService.obtenerProductosDelDia();
  }

  @Post('cierre-dia')
  @Permiso('almacen', 'cierre')
  async registrarCierreDia(@Body() dto: CierreDiaDto, @Req() req: any) {
    return this.almacenService.registrarCierreDia(dto, req.usuario, req.ip);
  }

  // --- Pedidos internos y Traslados ---
  @Get('pedidos-internos')
  @Permiso('almacen', 'pedidos_internos')
  async listarPedidosInternos() {
    return this.almacenService.listarPedidosInternos();
  }

  @Post('pedidos-internos')
  @Permiso('almacen', 'pedidos_internos')
  async crearPedidoInterno(@Body() dto: CrearPedidoInternoDto, @Req() req: any) {
    return this.almacenService.crearPedidoInterno(dto, req.usuario, req.ip);
  }

  @Post('pedidos-internos/:id/entregar')
  @Permiso('almacen', 'pedidos_internos')
  async entregarPedidoInterno(@Param('id') id: string, @Req() req: any) {
    return this.almacenService.entregarPedidoInterno(id, req.usuario, req.ip);
  }

  @Get('traslados')
  @Permiso('almacen', 'traslados')
  async listarTraslados() {
    return this.almacenService.listarTraslados();
  }

  @Post('traslados/:id/confirmar-recepcion')
  @Permiso('almacen', 'traslados')
  async confirmarRecepcionTraslado(
    @Param('id') id: string,
    @Body('recibido') recibido: number,
    @Req() req: any,
  ) {
    return this.almacenService.confirmarRecepcionTraslado(
      id,
      Number(recibido),
      req.usuario,
      req.ip,
    );
  }
}
