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
import { RepartosService } from './repartos.service';
import { FiltrarRepartosDto } from './dto/filtrar-repartos.dto';
import { ReportarFallaDto } from './dto/reportar-falla.dto';
import { ResolverFallaDto } from './dto/resolver-falla.dto';
import { ActualizarConfigRepartoDto } from './dto/actualizar-config-reparto.dto';
import { IniciarRutaDto } from './dto/iniciar-ruta.dto';
import { LiberarPedidoDto } from './dto/liberar-pedido.dto';
import { ReasignarPedidoDto } from './dto/reasignar-pedido.dto';

@Controller('admin/repartos')
@UseGuards(AccesoGuard)
export class RepartosController {
  constructor(private readonly repartosService: RepartosService) {}

  @Get('config')
  @Permiso('repartos', 'ver')
  async obtenerConfig() {
    return this.repartosService.obtenerConfig();
  }

  @Put('config')
  @Permiso('configuracion', 'editar')
  async actualizarConfig(
    @Body() dto: ActualizarConfigRepartoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.actualizarConfig(dto, req.usuario, ip);
  }

  @Get('zonas')
  @Permiso('repartos', 'ver')
  async listarZonas() {
    return this.repartosService.listarZonas();
  }

  @Get('disponibles')
  @Permiso('repartos', 'ver')
  async listarDisponibles(@Req() req?: any) {
    return req?.usuario
      ? this.repartosService.listarDisponibles(req.usuario)
      : this.repartosService.listarDisponibles();
  }

  @Get('mios')
  @Permiso('repartos', 'ver')
  async listarMios(@Req() req: any) {
    return this.repartosService.listarMios(req.usuario);
  }

  @Get('resumen')
  @Permiso('repartos', 'ver')
  async obtenerResumen(@Req() req?: any) {
    return req?.usuario
      ? this.repartosService.obtenerResumen(req.usuario)
      : this.repartosService.obtenerResumen();
  }

  @Get(':id/mensajes')
  @Permiso('repartos', 'ver')
  async consultarMensajes(@Param('id') id: string, @Req() req?: any) {
    return req?.usuario
      ? this.repartosService.consultarMensajes(id, req.usuario)
      : this.repartosService.consultarMensajes(id);
  }

  @Get()
  @Permiso('repartos', 'ver')
  async listarTodos(@Query() filtros: FiltrarRepartosDto, @Req() req: any) {
    return this.repartosService.listarTodos(filtros, req.usuario);
  }

  @Post('iniciar-ruta')
  @Permiso('repartos', 'tomar')
  async iniciarRuta(@Body() dto: IniciarRutaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.iniciarRuta(dto, req.usuario, ip);
  }

  @Post(':id/tomar')
  @Permiso('repartos', 'tomar')
  async tomarPedido(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.tomarPedido(id, req.usuario, ip);
  }

  @Post(':id/liberar')
  @Permiso('repartos', 'liquidar')
  async liberarPedido(
    @Param('id') id: string,
    @Body() dto: LiberarPedidoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.liberarPedido(id, dto, req.usuario, ip);
  }

  @Post(':id/reasignar')
  @Permiso('repartos', 'liquidar')
  async reasignarPedido(
    @Param('id') id: string,
    @Body() dto: ReasignarPedidoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.reasignarPedido(id, dto, req.usuario, ip);
  }

  @Post(':id/salir')
  @Permiso('repartos', 'entregar')
  async salir(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.salir(id, req.usuario, ip);
  }

  @Post(':id/llegue')
  @Permiso('repartos', 'entregar')
  async llegue(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.llegue(id, req.usuario, ip);
  }

  @Post(':id/entregar')
  @Permiso('repartos', 'entregar')
  async entregar(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.entregar(id, req.usuario, ip);
  }

  @Post(':id/reportar')
  @Permiso('repartos', 'reportar')
  async reportarFalla(
    @Param('id') id: string,
    @Body() dto: ReportarFallaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.reportarFalla(id, dto, req.usuario, ip);
  }

  @Post(':id/resolver')
  @Permiso('repartos', 'liquidar')
  async resolverFalla(
    @Param('id') id: string,
    @Body() dto: ResolverFallaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.resolverFalla(id, dto, req.usuario, ip);
  }
}
