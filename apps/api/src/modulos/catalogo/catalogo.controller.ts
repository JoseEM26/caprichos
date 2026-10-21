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
import { CatalogoService } from './catalogo.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { EditarProductoDto } from './dto/editar-producto.dto';
import { AgotarDto } from './dto/agotar.dto';
import { ActualizarCategoriaDto } from './dto/categoria.dto';
import { FiltrarProductosDto } from './dto/filtrar-productos.dto';

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
}
