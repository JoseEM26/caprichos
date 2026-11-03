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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobantesSunatService } from './comprobantes-sunat.service';
import { MarcarEmitidoDto } from './dto/marcar-emitido.dto';
import { ListarPorEmitirDto } from './dto/listar-por-emitir.dto';
import { AnularComprobanteDto, BoletaPorDefectoDto, ConfigFacturacionDto, ReintentarComprobanteDto } from './dto/facturacion.dto';
import { ComprobanteDefectoService } from './comprobante-defecto.service';

@Controller('admin/comprobantes')
@UseGuards(AccesoGuard)
export class ComprobantesController {
  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly sunatService: ComprobantesSunatService,
    private readonly comprobantesSalud: ComprobantesSaludService,
    private readonly boletaDefecto: ComprobanteDefectoService,
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
  async listarEmitidos(@Query('pagina') pagina?: string, @Query('limite') limite?: string, @Query('problemas') problemas?: string) {
    const p = Math.max(1, Number(pagina) || 1);
    const l = Math.max(1, Math.min(100, Number(limite) || 20));
    return this.comprobantesService.listarElectronicos(p, l, problemas === '1' || problemas === 'true');
  }

  /** GET /admin/comprobantes/salud : solo conteos para el monitoreo (ADMIN). Sin datos personales. */
  @Get('salud')
  @Permiso('comprobantes', 'ver')
  async salud(@Req() req: any) {
    if (req.usuario?.rol !== 'ADMIN') throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador ve la salud de la facturación' });
    return this.comprobantesSalud.salud();
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

  /** GET /admin/comprobantes/:id/pdf : representación impresa (PDF) de la boleta o factura electrónica. */
  @Get(':id/pdf')
  @Permiso('comprobantes', 'ver')
  async descargarPdf(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pdf = await this.comprobantesService.pdfComprobante(id, req.usuario, ip);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.nombre.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf.contenido);
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

  /** GET /admin/comprobantes/config/boleta-por-defecto: la marca y si hoy aplica (solo con SUNAT real). */
  @Get('config/boleta-por-defecto')
  @Permiso('comprobantes', 'ver')
  async obtenerBoletaPorDefecto() {
    return this.boletaDefecto.estado();
  }

  /** PUT /admin/comprobantes/config/boleta-por-defecto: sí/no (ADMIN; la web pide Sí/No). */
  @Put('config/boleta-por-defecto')
  @Permiso('configuracion', 'editar')
  async guardarBoletaPorDefecto(@Body() dto: BoletaPorDefectoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.boletaDefecto.guardar(dto.activo, req.usuario, ip);
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
