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
import { OfertasService } from './ofertas.service';
import { CrearOfertaDto } from './dto/crear-oferta.dto';
import { ActualizarOfertaDto } from './dto/actualizar-oferta.dto';
import { ActualizarReglasDto } from './dto/actualizar-reglas.dto';
import { CrearCuponDto } from './dto/crear-cupon.dto';
import { ActualizarCuponDto } from './dto/actualizar-cupon.dto';
import { AnularCuponEmitidoDto } from './dto/anular-cupon-emitido.dto';
import { CanjearCuponDto } from './dto/canjear-cupon.dto';
import { ValidarCuponCajaDto } from './dto/validar-cupon-caja.dto';

@Controller('admin/ofertas')
@UseGuards(AccesoGuard)
export class OfertasController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get()
  @Permiso('ofertas', 'ver')
  async listarOfertas(
    @Query('tipo') tipo?: string,
    @Query('soloActivas') soloActivas?: string,
    @Query('canal') canal?: string,
  ) {
    return this.ofertasService.listarOfertas(tipo, soloActivas === 'true', canal);
  }

  @Post()
  @Permiso('ofertas', 'crear')
  async crearOferta(@Body() dto: CrearOfertaDto, @Req() req: any) {
    return this.ofertasService.crearOferta(dto, req.usuario);
  }

  @Get('reglas')
  @Permiso('ofertas', 'ver')
  async obtenerReglas() {
    return this.ofertasService.obtenerReglasAcumulacion();
  }

  @Put('reglas')
  @Permiso('ofertas', 'editar')
  async actualizarReglas(@Body() dto: ActualizarReglasDto, @Req() req: any) {
    return this.ofertasService.actualizarReglasAcumulacion(dto, req.usuario);
  }

  @Get(':id')
  @Permiso('ofertas', 'ver')
  async obtenerPorId(@Param('id') id: string) {
    return this.ofertasService.obtenerOfertaPorId(id);
  }

  @Put(':id')
  @Permiso('ofertas', 'editar')
  async actualizarOferta(
    @Param('id') id: string,
    @Body() dto: ActualizarOfertaDto,
    @Req() req: any,
  ) {
    return this.ofertasService.actualizarOferta(id, dto, req.usuario);
  }

  @Patch(':id/estado')
  @Permiso('ofertas', 'editar')
  async cambiarEstadoOferta(
    @Param('id') id: string,
    @Body('activo') activo: boolean,
    @Body('visibleCarta') visibleCarta: boolean | undefined,
    @Req() req: any,
  ) {
    const visible = typeof visibleCarta === 'boolean' ? visibleCarta : undefined;
    return this.ofertasService.cambiarEstadoOferta(id, Boolean(activo), req.usuario, visible);
  }
}

@Controller('admin/cupones')
@UseGuards(AccesoGuard)
export class CuponesController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get()
  @Permiso('cupones', 'ver')
  async listarCupones(@Query('soloActivos') soloActivos?: string) {
    return this.ofertasService.listarCupones(soloActivos === 'true');
  }

  @Post()
  @Permiso('cupones', 'crear')
  async crearCupon(@Body() dto: CrearCuponDto, @Req() req: any) {
    return this.ofertasService.crearCupon(dto, req.usuario);
  }

  @Get('emitidos')
  @Permiso('cupones', 'ver')
  async listarCuponesEmitidos(
    @Query('estado') estado?: string,
    @Query('q') q?: string,
  ) {
    return this.ofertasService.listarCuponesEmitidos(estado, q);
  }

  @Post('emitidos/:id/anular')
  @Permiso('cupones', 'editar')
  async anularCuponEmitido(
    @Param('id') id: string,
    @Body() dto: AnularCuponEmitidoDto,
    @Req() req: any,
  ) {
    return this.ofertasService.anularCuponEmitido(id, dto, req.usuario);
  }

  /**
   * Solo valida (no canjea): descuento del cupón para el carrito del salón/caja con las mismas reglas
   * que al crear el pedido (calcularDescuentosParaPedido). Lo usa quien arma pedidos en caja o mozo.
   */
  @Post('validar')
  @Permiso('pedidos', 'crear')
  async validarEnCaja(@Body() dto: ValidarCuponCajaDto) {
    return this.ofertasService.validarCuponParaCaja(dto);
  }

  @Post('canjear')
  @Permiso('cupones', 'canjear')
  async canjearEnCaja(@Body() dto: CanjearCuponDto, @Req() req: any) {
    return this.ofertasService.canjearCuponEnCaja(dto, req.usuario);
  }

  @Get(':id')
  @Permiso('cupones', 'ver')
  async obtenerCupon(@Param('id') id: string) {
    return this.ofertasService.obtenerCuponPorId(id);
  }

  @Put(':id')
  @Permiso('cupones', 'editar')
  async actualizarCupon(
    @Param('id') id: string,
    @Body() dto: ActualizarCuponDto,
    @Req() req: any,
  ) {
    return this.ofertasService.actualizarCupon(id, dto, req.usuario);
  }

  @Patch(':id/estado')
  @Permiso('cupones', 'editar')
  async cambiarEstadoCupon(
    @Param('id') id: string,
    @Body('activo') activo: boolean,
    @Req() req: any,
  ) {
    return this.ofertasService.cambiarEstadoCupon(id, Boolean(activo), req.usuario);
  }

  @Patch(':id/orden')
  @Permiso('cupones', 'editar')
  async reordenarCupon(
    @Param('id') id: string,
    @Body('orden') orden: number,
    @Req() req: any,
  ) {
    return this.ofertasService.reordenarCupon(id, Number(orden), req.usuario);
  }
}
