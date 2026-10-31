import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ContenidoService } from './contenido.service';
import {
  ActualizarBorradorDisenoDto,
  ActualizarDestacadaDto,
  ActualizarNovedadDto,
  ActualizarNovedadesEncabezadoDto,
  CrearDestacadaDto,
  CrearMensajeCartaDto,
  CrearNovedadDto,
  GuardarPaletaDto,
} from './contenido.dto';

// =========================================================================
// ENDPOINTS PÚBLICOS DE LA CARTA VIRTUAL (GET /carta/contenido)
// =========================================================================
@Controller('carta/contenido')
export class CartaContenidoController {
  constructor(private readonly contenidoService: ContenidoService) {}

  @Get()
  async obtenerContenido() {
    return this.contenidoService.obtenerContenidoPublicoCarta();
  }

  @Post('comentario')
  async enviarComentario(@Body() dto: CrearMensajeCartaDto) {
    return this.contenidoService.crearComentarioCarta(dto);
  }
}

// =========================================================================
// ENDPOINTS ADMINISTRATIVOS (@UseGuards(AccesoGuard))
// =========================================================================
@Controller('admin/contenido')
@UseGuards(AccesoGuard)
export class ContenidoAdminController {
  constructor(private readonly contenidoService: ContenidoService) {}

  // --- Diseñador de la carta ---

  @Get('disenador')
  @Permiso('carta_diseno', 'ver')
  async obtenerDiseno() {
    return this.contenidoService.obtenerDisenoAdmin();
  }

  @Put('disenador/borrador')
  @Permiso('carta_diseno', 'editar')
  async guardarBorradorDiseno(@Body() dto: ActualizarBorradorDisenoDto, @Req() req: any) {
    return this.contenidoService.guardarBorradorDiseno(dto, req.usuario);
  }

  @Post('disenador/publicar')
  @Permiso('carta_diseno', 'publicar')
  async publicarDiseno(@Req() req: any) {
    return this.contenidoService.publicarDiseno(req.usuario);
  }

  @Post('disenador/descartar')
  @Permiso('carta_diseno', 'editar')
  async descartarDiseno(@Req() req: any) {
    return this.contenidoService.descartarDiseno(req.usuario);
  }

  // --- Novedades y publicidad ---

  @Get('novedades/encabezado')
  @Permiso('novedades', 'ver')
  async obtenerEncabezadoNovedades() {
    return this.contenidoService.obtenerNovedadesEncabezadoAdmin();
  }

  @Put('novedades/encabezado')
  @Permiso('novedades', 'editar')
  async guardarBorradorEncabezado(
    @Body() dto: ActualizarNovedadesEncabezadoDto,
    @Req() req: any,
  ) {
    return this.contenidoService.guardarBorradorNovedadesEncabezado(dto, req.usuario);
  }

  @Get('novedades/borrador')
  @Permiso('novedades', 'ver')
  async obtenerNovedadesBorrador() {
    return this.contenidoService.obtenerNovedadesBorrador();
  }

  @Put('novedades/borrador')
  @Permiso('novedades', 'editar')
  async guardarNovedadesBorrador(@Body() dto: { items?: unknown }, @Req() req: any) {
    return this.contenidoService.guardarNovedadesBorrador(dto?.items, req.usuario);
  }

  @Post('novedades/descartar')
  @Permiso('novedades', 'editar')
  async descartarNovedadesBorrador(@Req() req: any) {
    return this.contenidoService.descartarNovedadesEncabezado(req.usuario);
  }

  @Get('novedades/momentos')
  @Permiso('novedades', 'ver')
  async obtenerNovedadesMomentos() {
    return this.contenidoService.obtenerNovedadesMomentosAdmin();
  }

  @Put('novedades/momentos')
  @Permiso('novedades', 'editar')
  async guardarNovedadesMomentos(@Body() dto: { fotos?: unknown }, @Req() req: any) {
    return this.contenidoService.guardarNovedadesMomentosBorrador(dto?.fotos, req.usuario);
  }

  @Get('conocenos')
  @Permiso('novedades', 'ver')
  async obtenerConocenos() {
    return this.contenidoService.obtenerConocenosAdmin();
  }

  @Put('conocenos')
  @Permiso('novedades', 'editar')
  async guardarBorradorConocenos(@Body() dto: any, @Req() req: any) {
    return this.contenidoService.guardarBorradorConocenos(dto, req.usuario);
  }

  @Post('conocenos/publicar')
  @Permiso('novedades', 'editar')
  async publicarConocenos(@Req() req: any) {
    return this.contenidoService.publicarConocenos(req.usuario);
  }

  @Post('conocenos/descartar')
  @Permiso('novedades', 'editar')
  async descartarConocenos(@Req() req: any) {
    return this.contenidoService.descartarConocenos(req.usuario);
  }

  @Get('novedades')
  @Permiso('novedades', 'ver')
  async listarNovedades() {
    return this.contenidoService.listarNovedadesAdmin();
  }

  @Post('novedades')
  @Permiso('novedades', 'crear')
  async crearNovedad(@Body() dto: CrearNovedadDto, @Req() req: any) {
    return this.contenidoService.crearNovedad(dto, req.usuario);
  }

  @Put('novedades/:id')
  @Permiso('novedades', 'editar')
  async actualizarNovedad(
    @Param('id') id: string,
    @Body() dto: ActualizarNovedadDto,
    @Req() req: any,
  ) {
    return this.contenidoService.actualizarNovedad(id, dto, req.usuario);
  }

  @Delete('novedades/:id')
  @Permiso('novedades', 'editar')
  async eliminarNovedad(@Param('id') id: string, @Req() req: any) {
    return this.contenidoService.eliminarNovedad(id, req.usuario);
  }

  @Post('novedades/publicar')
  @Permiso('novedades', 'editar')
  async publicarNovedades(@Req() req: any) {
    return this.contenidoService.publicarNovedades(req.usuario);
  }

  // --- Destacadas de la carta ---

  @Get('destacadas')
  @Permiso('destacadas', 'ver')
  async listarDestacadas() {
    return this.contenidoService.listarDestacadasAdmin();
  }

  @Post('destacadas')
  @Permiso('destacadas', 'crear')
  async crearDestacada(@Body() dto: CrearDestacadaDto, @Req() req: any) {
    return this.contenidoService.crearDestacada(dto, req.usuario);
  }

  @Put('destacadas/:id')
  @Permiso('destacadas', 'editar')
  async actualizarDestacada(
    @Param('id') id: string,
    @Body() dto: ActualizarDestacadaDto,
    @Req() req: any,
  ) {
    return this.contenidoService.actualizarDestacada(id, dto, req.usuario);
  }

  @Put('destacadas/:id/archivar')
  @Permiso('destacadas', 'archivar')
  async archivarDestacada(
    @Param('id') id: string,
    @Body('archivada') archivada: boolean,
    @Req() req: any,
  ) {
    return this.contenidoService.archivarDestacada(id, archivada, req.usuario);
  }

  @Delete('destacadas/:id')
  @Permiso('destacadas', 'eliminar')
  async eliminarDestacada(@Param('id') id: string, @Req() req: any) {
    return this.contenidoService.eliminarDestacada(id, req.usuario);
  }

  @Post('destacadas/ejemplo')
  @Permiso('destacadas', 'editar')
  async cargarFotosEjemplo(@Req() req: any) {
    return this.contenidoService.cargarFotosEjemplo(req.usuario);
  }

  @Post('destacadas/publicar')
  @Permiso('destacadas', 'editar')
  async publicarDestacadas(@Req() req: any) {
    return this.contenidoService.publicarDestacadas(req.usuario);
  }

  // --- Paleta de colores ---

  @Get('paleta')
  @Permiso('carta_diseno', 'ver')
  async obtenerPaletas() {
    return this.contenidoService.obtenerPaletasAdmin();
  }

  @Put('paleta/borrador')
  @Permiso('carta_diseno', 'editar')
  async guardarBorradorPaleta(@Body() dto: GuardarPaletaDto, @Req() req: any) {
    return this.contenidoService.guardarBorradorPaleta(dto, req.usuario);
  }

  @Post('paleta/publicar')
  @Permiso('carta_diseno', 'publicar')
  async publicarPaleta(@Req() req: any) {
    return this.contenidoService.publicarPaleta(req.usuario);
  }

  @Post('paleta/descartar')
  @Permiso('carta_diseno', 'editar')
  async descartarPaleta(@Req() req: any) {
    return this.contenidoService.descartarPaleta(req.usuario);
  }

  // --- Mensajes de la carta ---

  @Get('mensajes')
  @Permiso('mensajes_carta', 'ver')
  async listarMensajes() {
    return this.contenidoService.listarMensajesAdmin();
  }

  @Put('mensajes/:id/atender')
  @Permiso('mensajes_carta', 'atender')
  async atenderMensaje(@Param('id') id: string, @Req() req: any) {
    return this.contenidoService.atenderMensaje(id, req.usuario);
  }

  // --- Ranking del mes ---

  @Get('ranking')
  @Permiso('carta_diseno', 'ver')
  async obtenerRanking() {
    return this.contenidoService.obtenerRankingAdmin();
  }

  @Put('ranking/estrellas')
  @Permiso('carta_diseno', 'editar')
  async toggleEstrellas(@Body('visible') visible: boolean, @Req() req: any) {
    return this.contenidoService.toggleVisibilidadEstrellas(visible, req.usuario);
  }
}
