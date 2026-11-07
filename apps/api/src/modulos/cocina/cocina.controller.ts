import {
  Body,
  Controller,
  ForbiddenException,
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
import { DespachoService } from './despacho.service';
import { AgotadosService } from './agotados.service';
import { AltaDemandaService } from './alta-demanda.service';
import { ComandasQueryDto } from './dto/comandas-query.dto';
import { HistorialQueryDto } from './dto/historial-query.dto';
import { AgotarDto } from './dto/agotar.dto';
import { AltaDemandaDto } from './dto/alta-demanda.dto';
import { MarcarListasDto } from './dto/marcar-listas.dto';
import { AtendidoDto } from './dto/atendido.dto';
import { DespacharDto } from './dto/despachar.dto';
import { MisAjustesCocinaDto } from './dto/mis-ajustes-cocina.dto';
import { AjustesPersonalesCocinaService } from './ajustes-personales.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { areasPermitidasDeUsuario } from '../acceso/roles-usuario';

@Controller('admin/cocina')
@UseGuards(AccesoGuard)
export class CocinaController {
  constructor(
    private readonly comandasService: ComandasService,
    private readonly agotadosService: AgotadosService,
    private readonly altaDemandaService: AltaDemandaService,
    private readonly ajustesPersonales: AjustesPersonalesCocinaService,
    private readonly prisma: PrismaService,
    private readonly despacho: DespachoService,
  ) {}

  /** Áreas que ve el usuario en cocina (null = todas). Regla única en areasPermitidasDeUsuario. */
  private async areasVisibles(req: any): Promise<string[] | null> {
    const ids = await areasPermitidasDeUsuario(this.prisma, req.usuario);
    return ids ? ids.map(String) : null;
  }

  private exigirAreaVisible(visibles: string[] | null, areaId: string | number) {
    if (visibles && !visibles.includes(String(areaId))) {
      throw new ForbiddenException({ codigo: 'AREA_NO_PERMITIDA', mensaje: 'Tu rol de cocina no ve esta área' });
    }
  }

  @Get('areas')
  @Permiso('cocina', 'ver')
  async listarAreas(@Req() req: any) {
    const areas = await this.comandasService.listarAreas();
    const visibles = await this.areasVisibles(req);
    if (!visibles) return areas;
    return (areas as any[]).filter((a) => visibles.includes(String(a.id)));
  }

  @Get('comandas')
  @Permiso('cocina', 'ver')
  async listarComandas(@Query() query: ComandasQueryDto, @Req() req: any) {
    const visibles = await this.areasVisibles(req);
    if (!visibles) return this.comandasService.listarComandas(query.area);
    if (query.area) {
      this.exigirAreaVisible(visibles, query.area);
      return this.comandasService.listarComandas(query.area);
    }
    // Vista general de un rol por área: las comandas de sus áreas, en orden de llegada
    const listas = await Promise.all(visibles.map((id) => this.comandasService.listarComandas(id)));
    return listas.flat().sort((x: any, y: any) => {
      if (x.despejada !== y.despejada) return x.despejada ? 1 : -1;
      return new Date(x.creado_en || x.llego_en).getTime() - new Date(y.creado_en || y.llego_en).getTime();
    });
  }

  /** Pantalla Despacho: pedidos completos del día, todas las áreas juntas (atendidos=true los incluye). */
  @Get('despacho')
  @Permiso('cocina', 'despacho')
  async listarDespacho(@Query('atendidos') atendidos?: string) {
    return this.despacho.listar(atendidos === 'true' || atendidos === '1');
  }

  @Post('despacho/:pedidoId/atendido')
  @Permiso('cocina', 'despacho')
  async marcarAtendido(@Param('pedidoId') pedidoId: string, @Body() dto: AtendidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.despacho.marcarAtendido(pedidoId, dto.atendido, req.usuario, ip);
  }

  @Post('comandas/:pedidoId/:areaId/despejar')
  @Permiso('cocina', 'despejar')
  async despejarComanda(
    @Param('pedidoId') pedidoId: string,
    @Param('areaId') areaId: string,
    @Req() req: any,
  ) {
    this.exigirAreaVisible(await this.areasVisibles(req), areaId);
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comandasService.despejar(pedidoId, areaId, req.usuario, ip);
  }

  /** Ajustes que ve el usuario: su preferencia personal si la tiene, si no el general del local. */
  @Get('ajustes')
  @Permiso('cocina', 'ver')
  async obtenerAjustes(@Req() req: any) {
    return this.ajustesPersonales.obtener(req.usuario.partyId);
  }

  /** Preferencia personal del cocinero que llama (el party sale del token). null = volver al general. */
  @Put('mis-ajustes')
  @Permiso('cocina', 'ver')
  async guardarMisAjustes(@Body() dto: MisAjustesCocinaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ajustesPersonales.guardar(req.usuario, dto.confirmarDespejar, ip);
  }

  @Get('historial')
  @Permiso('cocina', 'ver')
  async historial(@Query() query: HistorialQueryDto, @Req() req: any) {
    const visibles = await this.areasVisibles(req);
    if (!visibles) return this.comandasService.historial(query.area);
    if (query.area) {
      this.exigirAreaVisible(visibles, query.area);
      return this.comandasService.historial(query.area);
    }
    const listas = await Promise.all(visibles.map((id) => this.comandasService.historial(id)));
    return listas.flat();
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
    this.exigirAreaVisible(await this.areasVisibles(req), areaId);
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
