import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ImpresionService } from './impresion.service';
import {
  CrearLlaveDto,
  DescartarDto,
  VaciarColaDto,
  ReimprimirDto,
  PruebaImpresionDto,
  ElegirImpresoraDto,
  PruebaTodasDto,
} from './dto';

@Controller(['admin/impresion', 'api/admin/impresion'])
@UseGuards(AccesoGuard)
export class AdminImpresionController {
  constructor(private readonly impresionService: ImpresionService) {}

  @Get('estado')
  @Permiso('pedidos', 'ver')
  async obtenerEstado() {
    return this.impresionService.obtenerEstadoAdmin();
  }

  @Get('trabajos')
  @Permiso('pedidos', 'ver')
  async listarTrabajos(
    @Query('estado') estado?: string,
    @Query('pedido') pedido?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    const pag = pagina ? parseInt(pagina, 10) : 1;
    const lim = limite ? parseInt(limite, 10) : 20;
    return this.impresionService.listarTrabajos(estado, pedido, pag, lim);
  }

  @Get('cola')
  @Permiso('pedidos', 'ver')
  async listarCola(
    @Query('filtro') filtro?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Query('minutos') minutos?: string,
  ) {
    return this.impresionService.listarCola(
      filtro || 'pendientes',
      pagina ? parseInt(pagina, 10) : 1,
      limite ? parseInt(limite, 10) : 20,
      minutos ? parseInt(minutos, 10) : 30,
    );
  }

  // Descartar: ADMIN y CAJERO (el servicio valida el rol; COCINA tiene el permiso pero no descarta)
  @Post('cola/vaciar')
  @HttpCode(HttpStatus.OK)
  @Permiso('pedidos', 'cambiar_estado')
  async vaciarCola(@Body() dto: VaciarColaDto, @Req() req: any) {
    return this.impresionService.vaciarCola(dto, req.usuario, this.ip(req));
  }

  @Post('trabajos/:id/descartar')
  @HttpCode(HttpStatus.OK)
  @Permiso('pedidos', 'cambiar_estado')
  async descartarTrabajo(@Param('id') id: string, @Body() dto: DescartarDto, @Req() req: any) {
    return this.impresionService.descartarTrabajo(id, dto, req.usuario, this.ip(req));
  }

  @Post('pedidos/:id/descartar')
  @HttpCode(HttpStatus.OK)
  @Permiso('pedidos', 'cambiar_estado')
  async descartarPedido(@Param('id') id: string, @Body() dto: DescartarDto, @Req() req: any) {
    return this.impresionService.descartarPedido(id, dto, req.usuario, this.ip(req));
  }

  private ip(req: any): string | undefined {
    return (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  }

  /** Prueba de impresión: etiqueta o ticket de ejemplo sin pedido (quien ve la tarjeta de impresión). */
  @Post('prueba')
  @Permiso('pedidos', 'ver')
  async pruebaImpresion(@Body() dto: PruebaImpresionDto, @Req() req: any) {
    return this.impresionService.encolarPrueba(dto.rol, req.usuario, this.ip(req), dto.impresoraId, dto.equipoId);
  }

  /** «Probar TODAS»: una hoja con número grande en cada impresora del equipo del local. */
  @Post('prueba-todas')
  @Permiso('configuracion', 'editar')
  async pruebaTodas(@Body() dto: PruebaTodasDto, @Req() req: any) {
    return this.impresionService.encolarPruebaTodas(req.usuario, this.ip(req), dto.equipoId);
  }

  /** «Usar esta impresora»: elige cuál de las impresoras del equipo del local es la etiquetera o la ticketera. */
  @Post('seleccion')
  @HttpCode(HttpStatus.OK)
  @Permiso('configuracion', 'editar')
  async elegirImpresora(@Body() dto: ElegirImpresoraDto, @Req() req: any) {
    return this.impresionService.elegirImpresora(dto.rol, dto.impresoraId, req.usuario, this.ip(req), dto.equipoId);
  }

  @Get('prueba/:id')
  @Permiso('pedidos', 'ver')
  async estadoPrueba(@Param('id') id: string) {
    return this.impresionService.obtenerPrueba(id);
  }

  @Post('trabajos/:id/reintentar')
  @Permiso('pedidos', 'cambiar_estado')
  async reintentarTrabajo(@Param('id') id: string) {
    return this.impresionService.reintentarTrabajo(id);
  }

  @Post('pedidos/:id/reimprimir')
  @Permiso('pedidos', 'cambiar_estado')
  async reimprimir(
    @Param('id') id: string,
    @Body() dto: ReimprimirDto,
  ) {
    return this.impresionService.reimprimirEtiqueta(id, dto);
  }

  /** Código de un solo uso para vincular el programa del local (solo ADMIN). */
  @Post('codigo-vinculo')
  @Permiso('usuarios', 'crear')
  async codigoVinculo(@Req() req: any) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden vincular el programa de impresión',
      });
    }
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.generarCodigoVinculoAgente(host, req.usuario, ip);
  }

  @Get('llaves')
  @Permiso('usuarios', 'ver')
  async listarLlaves(@Req() req: any) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    return this.impresionService.listarLlavesAgente();
  }

  @Post('llaves')
  @Permiso('usuarios', 'crear')
  async crearLlave(
    @Body() dto: CrearLlaveDto,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.crearLlaveAgente(dto, req.usuario, ip);
  }

  @Patch('llaves/:id/desactivar')
  @Permiso('usuarios', 'desactivar')
  async desactivarLlave(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.desactivarLlaveAgente(id, req.usuario, ip);
  }

  @Post('llaves/:id/desactivar')
  @Permiso('usuarios', 'desactivar')
  async desactivarLlavePost(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.desactivarLlaveAgente(id, req.usuario, ip);
  }
}
