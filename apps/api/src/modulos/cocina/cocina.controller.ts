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
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { ComandasService } from './comandas.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';
import { ComandasQueryDto } from './dto/comandas-query.dto';
import { HistorialQueryDto } from './dto/historial-query.dto';
import { AgotarDto } from './dto/agotar.dto';
import { AltaDemandaDto } from './dto/alta-demanda.dto';
import { MarcarListasDto } from './dto/marcar-listas.dto';
import { DespacharDto } from './dto/despachar.dto';

@Controller('admin/cocina')
@UseGuards(AccesoGuard)
export class CocinaController {
  constructor(
    private readonly comandasService: ComandasService,
    private readonly agotadosService: AgotadosService,
    private readonly altaDemandaService: AltaDemandaService,
  ) {}

  @Get('areas')
  @Permiso('cocina', 'ver')
  async listarAreas() {
    return this.comandasService.listarAreas();
  }

  @Get('comandas')
  @Permiso('cocina', 'ver')
  async listarComandas(@Query() query: ComandasQueryDto) {
    return this.comandasService.listarComandas(query.area);
  }

  @Post('comandas/:pedidoId/:areaId/despejar')
  @Permiso('cocina', 'despejar')
  async despejarComanda(
    @Param('pedidoId') pedidoId: string,
    @Param('areaId') areaId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comandasService.despejar(pedidoId, areaId, req.usuario, ip);
  }

  @Get('ajustes')
  @Permiso('cocina', 'ver')
  async obtenerAjustes() {
    return this.comandasService.obtenerAjustes();
  }

  @Get('historial')
  @Permiso('cocina', 'ver')
  async historial(@Query() query: HistorialQueryDto) {
    return this.comandasService.historial(query.area);
  }

  @Post('lineas/:lineaId/listas')
  @Permiso('cocina', 'despejar')
  async marcarListas(@Param('lineaId') lineaId: string, @Body() dto: MarcarListasDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comandasService.marcarListas(lineaId, dto.listas, req.usuario, ip);
  }

  @Post('pedidos/:pedidoId/despachar')
  @Permiso('cocina', 'despachar')
  async despacharPedido(@Param('pedidoId') pedidoId: string, @Body() dto: DespacharDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comandasService.despachar(pedidoId, dto.lineas, req.usuario, ip);
  }

  @Post('comandas/:pedidoId/:areaId/devolver')
  @Permiso('cocina', 'devolver')
  async devolverComanda(
    @Param('pedidoId') pedidoId: string,
    @Param('areaId') areaId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comandasService.devolver(pedidoId, areaId, req.usuario, ip);
  }

  @Get('agotados')
  @Permiso('cocina', 'ver')
  async listarAgotados() {
    return this.agotadosService.listar();
  }

  @Post('agotados')
  @Permiso('cocina', 'agotar')
  async agotar(@Body() dto: AgotarDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.agotadosService.agotar(dto, req.usuario, ip);
  }

  @Post('agotados/:id/reactivar')
  @Permiso('cocina', 'agotar')
  async reactivarAgotado(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.agotadosService.reactivar(id, req.usuario, ip);
  }

  @Get('alta-demanda')
  @Permiso('cocina', 'ver')
  async obtenerAltaDemanda() {
    return this.altaDemandaService.obtenerEstado();
  }

  @Put('alta-demanda')
  @Permiso('cocina', 'demanda')
  @RequiereCodigoSupervisor('cocina/alta_demanda_pausa', {
    condicion: (req) => Boolean(req.body?.pausa),
  })
  async configurarAltaDemanda(@Body() dto: AltaDemandaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.altaDemandaService.configurar(dto, req.usuario, ip);
  }
}
