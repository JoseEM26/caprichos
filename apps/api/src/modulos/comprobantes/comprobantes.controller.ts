import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSunatService } from './comprobantes-sunat.service';
import { MarcarEmitidoDto } from './dto/marcar-emitido.dto';
import { ListarPorEmitirDto } from './dto/listar-por-emitir.dto';
import { AnularComprobanteDto, ConfigFacturacionDto, ReintentarComprobanteDto } from './dto/facturacion.dto';

@Controller('admin/comprobantes')
@UseGuards(AccesoGuard)
export class ComprobantesController {
  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly sunatService: ComprobantesSunatService,
  ) {}

  /**
   * GET /admin/comprobantes/por-emitir?pagina=&limite=
   * Lista paginada de boletas y facturas con estado POR_EMITIR.
   */
  @Get('por-emitir')
  @Permiso('comprobantes', 'ver')
  async listarPorEmitir(
    @Query() query: ListarPorEmitirDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.listarPorEmitir(query, req.usuario, ip);
  }

  /**
   * GET /admin/comprobantes/pedido/:pedidoId
   * Obtiene los datos completos para la impresión de la nota de venta.
   */
  @Get('pedido/:pedidoId')
  @Permiso('comprobantes', 'ver')
  async obtenerPorPedido(
    @Param('pedidoId') pedidoId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.obtenerPorPedido(pedidoId, req.usuario, ip);
  }

  /**
   * POST /admin/comprobantes/pedido/:pedidoId/reimprimir
   * Reimprime el comprobante marcándolo como «COPIA» y aumentando copias_impresas.
   */
  @Post('pedido/:pedidoId/reimprimir')
  @Permiso('comprobantes', 'reimprimir')
  async reimprimir(
    @Param('pedidoId') pedidoId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.reimprimirPorPedido(pedidoId, req.usuario, ip);
  }

  /**
   * POST /admin/comprobantes/:id/emitido
   * Marca el comprobante como emitido en el facturador externo con su referencia.
   */
  @Post(':id/emitido')
  @Permiso('comprobantes', 'emitir')
  async marcarEmitido(
    @Param('id') id: string,
    @Body() dto: MarcarEmitidoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.marcarEmitido(id, dto, req.usuario, ip);
  }

  /** GET /admin/comprobantes/emitidos?pagina=&limite= : BOLETA/FACTURA enviadas a SUNAT (cualquier estado). */
  @Get('emitidos')
  @Permiso('comprobantes', 'ver')
  async listarEmitidos(@Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    const p = Math.max(1, Number(pagina) || 1);
    const l = Math.max(1, Math.min(100, Number(limite) || 20));
    return this.comprobantesService.listarElectronicos(p, l);
  }

  /** GET /admin/comprobantes/:id/archivos/:tipo : XML firmado, ZIP o CDR de SUNAT (descarga). */
  @Get(':id/archivos/:tipo')
  @Permiso('comprobantes', 'ver')
  async descargarArchivo(@Param('id') id: string, @Param('tipo') tipo: string, @Req() req: any, @Res() res: Response) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const a = await this.comprobantesService.obtenerArchivo(id, tipo, req.usuario, ip);
    const tipoMime = a.tipo === 'ZIP' ? 'application/zip' : 'application/xml';
    res.setHeader('Content-Type', tipoMime);
    res.setHeader('Content-Disposition', `attachment; filename="${a.nombre.replace(/"/g, '')}"`);
    res.setHeader('X-Contenido-SHA256', a.sha256);
    res.end(a.contenido);
  }

  /** POST /admin/comprobantes/sunat/resumen : envía ahora el resumen diario de boletas pendientes (ADMIN). */
  @Post('sunat/resumen')
  @Permiso('comprobantes', 'emitir')
  async resumenSunat() {
    return this.sunatService.resumenDiario();
  }

  /** GET /admin/comprobantes/facturacion: IGV, series, proveedor y estado de credenciales (sin valores). */
  @Get('facturacion')
  @Permiso('comprobantes', 'ver')
  async obtenerFacturacion() {
    return this.comprobantesService.obtenerConfigFacturacion();
  }

  /** PUT /admin/comprobantes/facturacion: IGV y series (ADMIN; la web pide Sí/No). */
  @Put('facturacion')
  @Permiso('configuracion', 'editar')
  async guardarFacturacion(@Body() dto: ConfigFacturacionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.guardarConfigFacturacion(dto, req.usuario, ip);
  }

  /** POST /admin/comprobantes/:id/reintentar : reenvía al emisor (con correcciones opcionales). */
  @Post(':id/reintentar')
  @Permiso('comprobantes', 'emitir')
  async reintentar(@Param('id') id: string, @Body() dto: ReintentarComprobanteDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.reintentarElectronico(
      id,
      { documento: dto?.documento, razon: dto?.razon, direccion: dto?.direccion },
      req.usuario,
      ip,
    );
  }

  /** POST /admin/comprobantes/:id/anular : comunicación de baja con motivo. Nada se borra. */
  @Post(':id/anular')
  @Permiso('comprobantes', 'anular')
  async anular(@Param('id') id: string, @Body() dto: AnularComprobanteDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.anularElectronico(id, dto?.motivo ?? '', req.usuario, ip);
  }
}
