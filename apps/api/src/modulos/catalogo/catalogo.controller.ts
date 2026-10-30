import {
  Body,
  Controller,
  Get,
  Header,
  NotFoundException,
  StreamableFile,
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
import { pngImagenInicial } from './imagen-inicial';
import { CatalogoService } from './catalogo.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { EditarProductoDto } from './dto/editar-producto.dto';
import { AgotarDto } from './dto/agotar.dto';
import { ActualizarCategoriaDto, CrearCategoriaDto } from './dto/categoria.dto';
import { FiltrarProductosDto } from './dto/filtrar-productos.dto';
import {
  ActualizarGrupoOpcionesDto,
  ActualizarOpcionDto,
  CrearGrupoOpcionesDto,
  CrearOpcionDto,
} from './dto/grupo-opciones.dto';
import {
  ActualizarListaDto,
  ActualizarValorDto,
  AgregarValorDto,
  AsignarGrupoCategoriasDto,
  CrearListaDto,
} from './dto/lista.dto';

// ===========================================================================
// CARTA PÚBLICA (sin guard)
// ===========================================================================
@Controller('carta')
export class CartaController {
  constructor(private readonly catalogoService: CatalogoService) {}

  @Get()
  async obtenerCarta(@Query('q') q?: string) {
    return this.catalogoService.obtenerCarta(q);
  }

  /** Imagen pública (PNG) con las iniciales del producto, para tarjetas de WhatsApp sin foto. 404 si no existe u oculto. */
  @Get('productos/:id/imagen-inicial.png')
  @Header('Content-Type', 'image/png')
  @Header('Cache-Control', 'public, max-age=86400')
  async imagenInicial(@Param('id') id: string) {
    const nombre = /^\d+$/.test(id) ? await this.catalogoService.nombreProductoVisible(id) : null;
    if (!nombre) throw new NotFoundException('Producto no encontrado');
    return new StreamableFile(await pngImagenInicial(nombre));
  }
}

// ===========================================================================
// CATÁLOGO ADMINISTRATIVO (@UseGuards(AccesoGuard) + @Permiso)
// ===========================================================================
@Controller('admin/catalogo')
@UseGuards(AccesoGuard)
export class CatalogoController {
  constructor(private readonly catalogoService: CatalogoService) {}

  // --- Productos ---

  @Get('productos')
  @Permiso('catalogo', 'ver')
  async listarProductos(@Query() filtros: FiltrarProductosDto) {
    return this.catalogoService.listarProductosAdmin(filtros);
  }

  @Get('productos/:id')
  @Permiso('catalogo', 'ver')
  async obtenerProducto(@Param('id') id: string) {
    return this.catalogoService.obtenerProductoPorId(id);
  }

  @Post('productos')
  @Permiso('catalogo', 'crear')
  async crearProducto(@Body() dto: CrearProductoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.crearProducto(dto, req.usuario, ip);
  }

  @Patch('productos/:id')
  @Permiso('catalogo', 'editar')
  async editarProducto(
    @Param('id') id: string,
    @Body() dto: EditarProductoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.editarProducto(id, dto, req.usuario, ip);
  }

  @Post('productos/:id/agotar')
  @Permiso('catalogo', 'agotar')
  async agotarProducto(
    @Param('id') id: string,
    @Body() dto: AgotarDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.agotarProducto(id, dto, req.usuario, ip);
  }

  @Post('productos/:id/disponible')
  @Permiso('catalogo', 'agotar')
  async disponibilizarProducto(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.disponibilizarProducto(id, req.usuario, ip);
  }

  @Post('productos/:id/ocultar')
  @Permiso('catalogo', 'ocultar')
  async ocultarProducto(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.ocultarProducto(id, req.usuario, ip);
  }

  @Post('productos/:id/mostrar')
  @Permiso('catalogo', 'ocultar')
  async mostrarProducto(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.mostrarProducto(id, req.usuario, ip);
  }

  @Put('productos/:id/foto')
  @Permiso('catalogo', 'editar')
  async asociarFoto(
    @Param('id') id: string,
    @Body('fotoArchivoId') fotoArchivoId: string | number | null,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.asociarFotoProducto(id, fotoArchivoId, req.usuario, ip);
  }

  // --- Opciones ---

  @Post('opciones/:id/agotar')
  @Permiso('catalogo', 'agotar')
  async agotarOpcion(
    @Param('id') id: string,
    @Body() dto: AgotarDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.agotarOpcion(id, dto, req.usuario, ip);
  }

  @Post('opciones/:id/disponible')
  @Permiso('catalogo', 'agotar')
  async disponibilizarOpcion(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.disponibilizarOpcion(id, req.usuario, ip);
  }

  @Post('opciones/:id/ocultar')
  @Permiso('catalogo', 'ocultar')
  async ocultarOpcion(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.ocultarOpcion(id, req.usuario, ip);
  }

  @Post('opciones/:id/mostrar')
  @Permiso('catalogo', 'ocultar')
  async mostrarOpcion(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.mostrarOpcion(id, req.usuario, ip);
  }

  @Patch('opciones/:id')
  @Permiso('catalogo', 'editar')
  async editarOpcion(@Param('id') id: string, @Body() dto: ActualizarOpcionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.editarOpcion(id, dto, req.usuario, ip);
  }

  // --- Categorías ---

  @Get('categorias')
  @Permiso('catalogo', 'ver')
  async listarCategorias() {
    return this.catalogoService.listarCategoriasAdmin();
  }

  @Patch('categorias/:id')
  @Permiso('catalogo', 'editar')
  async actualizarCategoria(
    @Param('id') id: string,
    @Body() dto: ActualizarCategoriaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.actualizarCategoria(id, dto, req.usuario, ip);
  }

  @Post('categorias/:id/ocultar')
  @Permiso('catalogo', 'ocultar')
  async ocultarCategoria(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.ocultarCategoria(id, req.usuario, ip);
  }

  @Post('categorias/:id/mostrar')
  @Permiso('catalogo', 'ocultar')
  async mostrarCategoria(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.mostrarCategoria(id, req.usuario, ip);
  }

  @Post('categorias')
  @Permiso('catalogo', 'crear')
  async crearCategoria(@Body() dto: CrearCategoriaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.crearCategoria(dto, req.usuario, ip);
  }

  // --- Listas y valores ---

  @Get('listas')
  @Permiso('catalogo', 'ver')
  async listarListas() {
    return this.catalogoService.listarListasAdmin();
  }

  @Post('listas')
  @Permiso('catalogo', 'crear')
  async crearLista(@Body() dto: CrearListaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.crearLista(dto, req.usuario, ip);
  }

  @Patch('listas/:id')
  @Permiso('catalogo', 'editar')
  async actualizarLista(
    @Param('id') id: string,
    @Body() dto: ActualizarListaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.actualizarLista(id, dto, req.usuario, ip);
  }

  @Post('listas/:id/valores')
  @Permiso('catalogo', 'crear')
  async agregarValor(
    @Param('id') id: string,
    @Body() dto: AgregarValorDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.agregarValorLista(id, dto, req.usuario, ip);
  }

  @Patch('valores/:id')
  @Permiso('catalogo', 'editar')
  async actualizarValor(
    @Param('id') id: string,
    @Body() dto: ActualizarValorDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.actualizarValorLista(id, dto, req.usuario, ip);
  }

  @Post('valores/:id/alternar')
  @Permiso('catalogo', 'ocultar')
  async alternarValor(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.alternarValorLista(id, req.usuario, ip);
  }

  // --- Grupos de opciones ---

  @Get('grupos')
  @Permiso('catalogo', 'ver')
  async listarGrupos() {
    return this.catalogoService.listarGruposAdmin();
  }

  @Post('grupos')
  @Permiso('catalogo', 'crear')
  async crearGrupo(@Body() dto: CrearGrupoOpcionesDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.crearGrupo(dto, req.usuario, ip);
  }

  @Patch('grupos/:id')
  @Permiso('catalogo', 'editar')
  async actualizarGrupo(
    @Param('id') id: string,
    @Body() dto: ActualizarGrupoOpcionesDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.actualizarGrupo(id, dto, req.usuario, ip);
  }

  @Post('grupos/:id/categorias')
  @Permiso('catalogo', 'editar')
  async asignarGrupoCategorias(
    @Param('id') id: string,
    @Body() dto: AsignarGrupoCategoriasDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.asignarGrupoCategorias(id, dto.categoriaIds, req.usuario, ip);
  }

  @Post('grupos/:id/opciones')
  @Permiso('catalogo', 'crear')
  async crearOpcion(@Param('id') id: string, @Body() dto: CrearOpcionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.catalogoService.crearOpcionGrupo(id, dto, req.usuario, ip);
  }
}
