import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import {
  EditarNombreContactoDto,
  AnterioresDto,
  AtendidoDto,
  DocumentoDto,
  ImagenDto,
  ListarConversacionesDto,
  RechazarCambioDto,
  RechazarPagoDto,
  TextoDto,
  TomarDto,
} from './dto/mensajes.dto';
import { MensajesService } from './mensajes.service';
import { conServerTiming } from './utilidades/server-timing.util';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

@Controller('admin/mensajes')
@UseGuards(AccesoGuard)
export class MensajesController {
  constructor(private readonly mensajes: MensajesService) {}

  @Get('conversaciones')
  @Permiso('mensajes', 'ver')
  listar(@Query() f: ListarConversacionesDto, @Res({ passthrough: true }) res: Response) {
    return conServerTiming(res, 'conversaciones', () => this.mensajes.listar(f.filtro, f.q, f.pos), (r) => r.chats.length);
  }

  @Get('respuestas-rapidas')
  @Permiso('mensajes', 'ver')
  respuestasRapidas() {
    return this.mensajes.respuestasRapidas();
  }

  @Get('conversaciones/:id')
  @Permiso('mensajes', 'ver')
  detalle(@Param('id') id: string, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return conServerTiming(res, 'conversaciones/:id', () => this.mensajes.detalle(id, req.usuario), (r) => r.mensajes.length);
  }

  /** «Cargar anteriores»: la página de historial previa a `antes` (id del mensaje más antiguo que ya se tiene). */
  @Get('conversaciones/:id/mensajes')
  @Permiso('mensajes', 'ver')
  anteriores(@Param('id') id: string, @Query() q: AnterioresDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return conServerTiming(res, 'conversaciones/:id/mensajes', () => this.mensajes.mensajesAnteriores(id, q.antes, req.usuario), (r) => r.mensajes.length);
  }

  @Post('conversaciones/:id/enviar')
  @Permiso('mensajes', 'enviar')
  enviar(@Param('id') id: string, @Body() dto: TextoDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    return conServerTiming(res, 'conversaciones/:id/enviar', () => this.mensajes.enviar(id, dto.texto, req.usuario, ipDe(req), dto.idCliente));
  }

  @Post('conversaciones/:id/enviar-imagen')
  @Permiso('mensajes', 'enviar')
  @UseInterceptors(FileInterceptor('imagen', { limits: { fileSize: 16 * 1024 * 1024 + 1 } }))
  enviarImagen(
    @Param('id') id: string,
    @UploadedFile() imagen: Express.Multer.File,
    @Body() dto: ImagenDto,
    @Req() req: any,
  ) {
    return this.mensajes.enviarImagen(id, imagen, dto?.subtitulo, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/enviar-documento')
  @Permiso('mensajes', 'enviar')
  @UseInterceptors(FileInterceptor('documento', { limits: { fileSize: 16 * 1024 * 1024 + 1 } }))
  enviarDocumento(
    @Param('id') id: string,
    @UploadedFile() documento: Express.Multer.File,
    @Body() dto: DocumentoDto,
    @Req() req: any,
  ) {
    return this.mensajes.enviarDocumento(id, documento, dto?.nombre, req.usuario, ipDe(req));
  }

  /** Descarga de un documento del chat: solo con sesión y permiso, siempre como archivo adjunto (nunca se abre en la página). */
  @Get('documentos/:mensajeId')
  @Permiso('mensajes', 'ver')
  async descargarDocumento(@Param('mensajeId') mensajeId: string, @Req() req: any, @Res() res: Response) {
    const d = await this.mensajes.documentoDeMensaje(mensajeId, req.usuario, ipDe(req), req.headers?.['user-agent']);
    res.setHeader('Content-Type', d.tipoMime || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(d.nombre)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', d.bytes);
    fs.createReadStream(d.rutaAbsoluta).pipe(res);
  }

  @Post('conversaciones/:id/reabrir-plantilla')
  @Permiso('mensajes', 'enviar')
  reabrirPlantilla(@Param('id') id: string, @Body() cuerpo: { forzar?: boolean } | undefined, @Req() req: any) {
    return this.mensajes.reabrirConPlantilla(id, req.usuario, ipDe(req), cuerpo?.forzar === true);
  }

  @Post('conversaciones/:id/mensajes/:mensajeId/reintentar')
  @Permiso('mensajes', 'enviar')
  reintentar(
    @Param('id') id: string,
    @Param('mensajeId') mensajeId: string,
    @Req() req: any,
  ) {
    return this.mensajes.reintentarMensaje(id, mensajeId, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/pulir')
  @Permiso('mensajes', 'enviar')
  async pulir(@Param('id') id: string, @Body() dto: TextoDto, @Req() req: any) {
    const d = await this.mensajes.detalle(id, req.usuario);
    return this.mensajes.pulir(id, dto.texto, d.nombre);
  }

  @Post('conversaciones/:id/tomar')
  @Permiso('mensajes', 'tomar')
  tomar(@Param('id') id: string, @Body() dto: TomarDto, @Req() req: any) {
    return this.mensajes.tomar(id, !!dto?.forzar, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/soltar')
  @Permiso('mensajes', 'tomar')
  soltar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.soltar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/pausar')
  @Permiso('mensajes', 'tomar')
  pausar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.pausar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/reanudar')
  @Permiso('mensajes', 'tomar')
  reanudar(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.reanudar(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/visto')
  @Permiso('mensajes', 'ver')
  visto(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.marcarVisto(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/no-visto')
  @Permiso('mensajes', 'ver')
  noVisto(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.marcarNoVisto(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/atendido')
  @Permiso('mensajes', 'cerrar')
  atendido(@Param('id') id: string, @Body() dto: AtendidoDto, @Req() req: any) {
    return this.mensajes.marcarAtendido(id, req.usuario, ipDe(req), !!dto?.confirmar);
  }

  @Post('conversaciones/:id/volver-por-atender')
  @Permiso('mensajes', 'cerrar')
  volverPorAtender(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.volverPorAtender(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/aprobar-pago')
  @Permiso('mensajes', 'enviar')
  aprobarPago(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.aprobarPago(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/rechazar-pago')
  @Permiso('mensajes', 'enviar')
  rechazarPago(
    @Param('id') id: string,
    @Body() dto: RechazarPagoDto,
    @Req() req: any,
  ) {
    return this.mensajes.rechazarPago(id, dto?.motivo, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/aplicar-cambio')
  @Permiso('mensajes', 'enviar')
  aplicarCambio(@Param('id') id: string, @Req() req: any) {
    return this.mensajes.aplicarCambio(id, req.usuario, ipDe(req));
  }

  @Post('conversaciones/:id/rechazar-cambio')
  @Permiso('mensajes', 'enviar')
  rechazarCambio(
    @Param('id') id: string,
    @Body() dto: RechazarCambioDto,
    @Req() req: any,
  ) {
    return this.mensajes.rechazarCambio(id, dto?.motivo, req.usuario, ipDe(req));
  }

  @Patch('conversaciones/:id/nombre')
  @Permiso('mensajes', 'tomar')
  editarNombre(
    @Param('id') id: string,
    @Body() dto: EditarNombreContactoDto,
    @Req() req: any,
  ) {
    return this.mensajes.editarNombre(id, dto, req.usuario, ipDe(req));
  }
}
