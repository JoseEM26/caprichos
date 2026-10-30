import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { InsumosService } from './insumos.service';
import { StockService } from './stock.service';
import { RecetasService } from './recetas.service';
import { CrearInsumoDto } from './dto/crear-insumo.dto';
import { ActualizarInsumoDto } from './dto/actualizar-insumo.dto';
import { MovimientoManualDto } from './dto/movimiento-manual.dto';
import { InsumosQueryDto } from './dto/insumos-query.dto';
import { MovimientosQueryDto } from './dto/movimientos-query.dto';
import { GuardarRecetaDto } from './dto/guardar-receta.dto';

@Controller('admin/stock')
@UseGuards(AccesoGuard)
export class StockController {
  constructor(
    private readonly insumosService: InsumosService,
    private readonly stockService: StockService,
    private readonly recetasService: RecetasService,
  ) {}

  @Get('control')
  @Permiso('stock', 'ver')
  async estadoControl() {
    return this.stockService.estadoControl();
  }

  @Get('lugares')
  @Permiso('stock', 'ver')
  async listarLugares() {
    return this.insumosService.listarLugares();
  }

  @Get('insumos')
  @Permiso('stock', 'ver')
  async listarInsumos(@Query() query: InsumosQueryDto) {
    return this.insumosService.listar(query);
  }

  @Get('insumos/:id')
  @Permiso('stock', 'ver')
  async obtenerInsumo(@Param('id') id: string) {
    return this.insumosService.obtenerPorId(id);
  }

  @Post('insumos')
  @Permiso('stock', 'editar')
  async crearInsumo(@Body() dto: CrearInsumoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.insumosService.crear(dto, req.usuario, ip);
  }

  @Patch('insumos/:id')
  @Permiso('stock', 'editar')
  async actualizarInsumo(
    @Param('id') id: string,
    @Body() dto: ActualizarInsumoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.insumosService.actualizar(id, dto, req.usuario, ip);
  }

  @Post('insumos/:id/desactivar')
  @Permiso('stock', 'editar')
  async desactivarInsumo(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.insumosService.desactivar(id, req.usuario, ip);
  }

  @Post('insumos/:id/activar')
  @Permiso('stock', 'editar')
  async activarInsumo(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.insumosService.activar(id, req.usuario, ip);
  }

  @Get('existencias')
  @Permiso('stock', 'ver')
  async existencias() {
    return this.stockService.obtenerExistenciasPorLugar();
  }

  @Post('movimientos')
  @Permiso('stock', 'movimientos')
  async registrarMovimiento(@Body() dto: MovimientoManualDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.stockService.registrarMovimientoManual(dto, req.usuario, ip);
  }

  @Get('movimientos')
  @Permiso('stock', 'ver')
  async listarMovimientos(@Query() query: MovimientosQueryDto) {
    return this.stockService.listarMovimientos(query);
  }

  // Rutas alias para recetas bajo /admin/stock/recetas
  @Get('recetas')
  @Permiso('recetas', 'ver')
  async listarRecetas() {
    return this.recetasService.listarProductosConMargen();
  }

  @Get('recetas/:productoId')
  @Permiso('recetas', 'ver')
  async obtenerReceta(@Param('productoId') productoId: string) {
    return this.recetasService.obtenerRecetaProducto(productoId);
  }

  @Put('recetas/:productoId')
  @Permiso('recetas', 'editar')
  async guardarReceta(
    @Param('productoId') productoId: string,
    @Body() dto: GuardarRecetaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.recetasService.guardarReceta(productoId, dto, req.usuario, ip);
  }
}
