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
import { UbicacionRepartidorService } from './ubicacion-repartidor.service';
import { UbicacionRepartidorDto } from './dto/ubicacion-repartidor.dto';
import { RepartosChatService } from './repartos-chat.service';
import { TextoDto } from '../mensajes/dto/mensajes.dto';
import { FiltrarRepartosDto } from './dto/filtrar-repartos.dto';
import { FiltrarRutasDto } from './dto/filtrar-rutas.dto';
import { ReportarFallaDto } from './dto/reportar-falla.dto';
import { ResolverFallaDto } from './dto/resolver-falla.dto';
import { ActualizarConfigRepartoDto } from './dto/actualizar-config-reparto.dto';
import { SinCobroDto } from './dto/sin-cobro.dto';
import { IniciarRutaDto } from './dto/iniciar-ruta.dto';
import { LiberarPedidoDto } from './dto/liberar-pedido.dto';
import { CerrarPorRepartidorDto } from './dto/cerrar-por-repartidor.dto';
import { ReasignarPedidoDto } from './dto/reasignar-pedido.dto';
import { SaltarPedidoDto } from './dto/saltar-pedido.dto';
import { TomarRutaDto } from './dto/tomar-ruta.dto';
import { TomarRutaSugeridaDto } from './dto/tomar-ruta-sugerida.dto';

/** Lecturas del seguimiento: las ve quien reparte (ver) y quien solo sigue el delivery (seguir). */
const VER_O_SEGUIR = [
    { modulo: 'repartos', accion: 'ver' },
    { modulo: 'repartos', accion: 'seguir' },
  ];

@Controller('admin/repartos')
@UseGuards(AccesoGuard)
export class RepartosController {
  constructor(
    private readonly repartosService: RepartosService,
    private readonly repartosChat: RepartosChatService,
    private readonly ubicaciones: UbicacionRepartidorService,
  ) {}

  /** El repartidor con pedidos en camino manda su posición; solo el local la ve. */
  @Post('ubicacion')
  @Permiso('repartos', 'entregar')
  async enviarUbicacion(@Body() dto: UbicacionRepartidorDto, @Req() req: any) {
    return this.ubicaciones.registrar(dto, req.usuario);
  }

  /** Posiciones vigentes (<15 min): el personal las ve todas; el repartidor, solo la suya. */
  @Get('ubicaciones')
  @Permiso([
    { modulo: 'repartos', accion: 'ver_ubicacion' },
    { modulo: 'repartos', accion: 'entregar' },
  ])
  async verUbicaciones(@Req() req: any) {
    return this.ubicaciones.listar(req.usuario);
  }

  @Get('config')
  @Permiso(VER_O_SEGUIR)
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
  @Permiso(VER_O_SEGUIR)
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

  /** Rutas del repartidor que consulta (ignora cualquier filtro de repartidor). */
  @Get('mis-rutas')
  @Permiso('repartos', 'ver')
  async listarMisRutas(@Query() filtros: FiltrarRutasDto, @Req() req: any) {
    return this.repartosService.listarRutas(filtros, req.usuario, true);
  }

  /** Rutas de cualquier repartidor para caja/admin; si lo llama un repartidor ve solo las suyas. */
  @Get('rutas')
  @Permiso(VER_O_SEGUIR)
  async listarRutas(@Query() filtros: FiltrarRutasDto, @Req() req: any) {
    return this.repartosService.listarRutas(filtros, req.usuario);
  }

  @Get('proximos')
  @Permiso('repartos', 'ver')
  async listarProximos(@Req() req: any) {
    return this.repartosService.listarProximos(req.usuario);
  }

  @Post('tomar-ruta')
  @Permiso('repartos', 'tomar')
  async tomarRuta(@Body() dto: TomarRutaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.tomarRuta(dto, req.usuario, ip);
  }

  @Get(':id/resumen-repartidor')
  @Permiso('repartos', 'ver')
  async resumenRepartidor(@Param('id') id: string, @Req() req: any) {
    return this.repartosService.resumenRepartidor(id, req.usuario);
  }

  @Get('rutas-sugeridas')
  @Permiso('repartos', 'ver')
  async listarRutasSugeridas(@Req() req: any) {
    return this.repartosService.listarRutasSugeridas(req.usuario);
  }

  @Post('rutas-sugeridas/:idOpcion/tomar')
  @Permiso('repartos', 'tomar')
  async tomarRutaSugerida(
    @Param('idOpcion') idOpcion: string,
    @Body() dto: TomarRutaSugeridaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.tomarRutaSugerida(idOpcion, dto, req.usuario, ip);
  }

  @Get('resumen')
  @Permiso('repartos', 'ver')
  async obtenerResumen(@Req() req?: any) {
    return req?.usuario
      ? this.repartosService.obtenerResumen(req.usuario)
      : this.repartosService.obtenerResumen();
  }

  /** Contadores del delivery por etapa (en cocina, listos, en camino, entregados hoy). */
  @Get('contadores')
  @Permiso(VER_O_SEGUIR)
  async contadores(@Req() req: any) {
    return this.repartosService.contadoresDelivery(req.usuario);
  }

  /** Panel de repartidores para caja y admin: el REPARTIDOR recibe 403 (lo valida el servicio). */
  @Get('panel')
  @Permiso(VER_O_SEGUIR)
  async panelRepartidores(@Req() req: any) {
    return this.repartosService.obtenerPanelRepartidores(req.usuario);
  }

  /** Todos los pedidos delivery de hoy en cualquier estado, para el seguimiento (nunca REPARTIDOR). */
  @Get('seguimiento')
  @Permiso(VER_O_SEGUIR)
  async seguimiento(@Req() req: any) {
    return this.repartosService.listarSeguimiento(req.usuario);
  }

  @Get(':id/mensajes')
  @Permiso('repartos', 'ver')
  async consultarMensajes(@Param('id') id: string, @Req() req?: any) {
    return req?.usuario
      ? this.repartosService.consultarMensajes(id, req.usuario)
      : this.repartosService.consultarMensajes(id);
  }

  @Get()
  @Permiso(VER_O_SEGUIR)
  async listarTodos(@Query() filtros: FiltrarRepartosDto, @Req() req: any) {
    return this.repartosService.listarTodos(filtros, req.usuario);
  }

  @Post('iniciar-ruta')
  @Permiso('repartos', 'tomar')
  async iniciarRuta(@Body() dto: IniciarRutaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.iniciarRuta(dto, req.usuario, ip);
  }

  @Post('ruta/cerrar')
  @Permiso([
    { modulo: 'repartos', accion: 'entregar' },
    { modulo: 'repartos', accion: 'liquidar' },
  ])
  async cerrarRuta(@Body() dto: { repartidorId?: string }, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.cerrarRuta(dto?.repartidorId, req.usuario, ip);
  }

  @Post(':id/devolver-local')
  @Permiso('repartos', 'entregar')
  async devolverAlLocal(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.devolverAlLocal(id, req.usuario, ip);
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

  /** ADMIN y SUPERVISOR: asigna el repartidor (si hace falta) y cierra el reparto por él; el repartidor figura como quien entregó. */
  @Post(':id/cerrar-por-repartidor')
  @Permiso('repartos', 'liquidar')
  async cerrarPorRepartidor(@Param('id') id: string, @Body() dto: CerrarPorRepartidorDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.cerrarPorRepartidor(id, dto, req.usuario, ip);
  }

  @Post(':id/salir')
  @Permiso('repartos', 'entregar')
  async salir(@Param('id') id: string, @Body() dto: SinCobroDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.salir(id, req.usuario, ip, dto);
  }

  @Post(':id/llegue')
  @Permiso('repartos', 'entregar')
  async llegue(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.llegue(id, req.usuario, ip);
  }

  @Post(':id/entregar')
  @Permiso('repartos', 'entregar')
  async entregar(@Param('id') id: string, @Body() dto: SinCobroDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.entregar(id, req.usuario, ip, dto);
  }

  @Post(':id/empezar-por')
  @Permiso('repartos', 'tomar')
  async empezarPor(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.empezarPor(id, req.usuario, ip);
  }

  @Post(':id/saltar')
  @Permiso('repartos', 'entregar')
  async saltar(@Param('id') id: string, @Body() dto: SaltarPedidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.saltar(id, dto, req.usuario, ip);
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

  /** Chat de WhatsApp de un pedido propio y vigente: solo esa conversación. */
  @Get(':id/chat/mensajes')
  @Permiso('repartos', 'chat')
  async chatMensajes(@Param('id') id: string, @Req() req: any) {
    return this.repartosChat.obtenerChat(id, req.usuario);
  }

  @Post(':id/chat/mensajes')
  @Permiso('repartos', 'chat')
  async chatEnviar(@Param('id') id: string, @Body() dto: TextoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosChat.enviar(id, dto.texto, req.usuario, ip);
  }

  @Post(':id/reprogramar')
  @Permiso('repartos', 'liquidar')
  async reprogramarPedido(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.repartosService.reprogramarPedido(id, req.usuario, ip);
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
