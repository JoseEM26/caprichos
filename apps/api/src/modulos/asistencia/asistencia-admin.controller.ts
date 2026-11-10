import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import {
  AprobarSimplesDto, LoteDto, ConfigurarAsistenciaDto, CorregirMarcaDto, CronogramaDto, ListarMarcasDto, RechazarSolicitudDto, ReasignarMarcaDto,
  ReporteMesDto, ResolverSolicitudDto, RevisarMarcaDto,
} from './dto/asistencia.dto';
import { AsistenciaCorreccionesService } from './asistencia-correcciones.service';
import { AsistenciaService } from './asistencia.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Pantalla del local y reportes: solo ADMIN (permiso asistencia/administrar), salvo la pantalla del QR. */
@Controller('admin/asistencia')
@UseGuards(AccesoGuard)
export class AsistenciaAdminController {
  constructor(
    private readonly asistencia: AsistenciaService,
    private readonly correcciones: AsistenciaCorreccionesService,
  ) {}

  @Get('pantalla/qr')
  @Permiso('asistencia', 'pantalla')
  qrPantalla() {
    return this.asistencia.qrPantalla();
  }

  /** Enlace público de la pantalla del local: solo dice si está activo (el token nunca se vuelve a mostrar). */
  @Get('pantalla/enlace')
  @Permiso('asistencia', 'administrar')
  estadoEnlace() {
    return this.asistencia.estadoEnlacePantalla();
  }

  @Post('pantalla/enlace')
  @Permiso('asistencia', 'administrar')
  @Header('Cache-Control', 'no-store')
  generarEnlace(@Req() req: any) {
    return this.asistencia.generarEnlacePantalla(req.usuario, ipDe(req));
  }

  @Delete('pantalla/enlace')
  @Permiso('asistencia', 'administrar')
  desactivarEnlace(@Req() req: any) {
    return this.asistencia.desactivarEnlacePantalla(req.usuario, ipDe(req));
  }

  @Get('hoy')
  @Permiso('asistencia', 'administrar')
  hoy() {
    return this.asistencia.reporteHoy();
  }

  @Get('mes')
  @Permiso('asistencia', 'administrar')
  async mes(@Query() q: ReporteMesDto, @Res({ passthrough: true }) res: Response) {
    const r = await this.asistencia.reporteMes(q.anio, q.mes, q.formato ?? 'json');
    if ('csv' in r) {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${r.nombre}"` });
      return r.csv;
    }
    return r;
  }

  @Get('marcas')
  @Permiso('asistencia', 'administrar')
  marcas(@Query() q: ListarMarcasDto) {
    return this.asistencia.listarMarcas(q);
  }

  @Get('marcas/:id/selfie')
  @Permiso('asistencia', 'administrar')
  async selfie(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const s = await this.asistencia.obtenerSelfie(Number(id), req.usuario, ipDe(req));
    res.set({ 'Content-Type': s.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(s.contenido);
  }

  @Post('correcciones')
  @Permiso('asistencia', 'administrar')
  corregir(@Body() dto: CorregirMarcaDto, @Req() req: any) {
    return this.asistencia.corregir(dto, req.usuario, ipDe(req));
  }

  /** Aprobar una marca pendiente (la de usuario y contraseña, o con alertas de GPS): desde ahí cuenta. */
  @Post('marcas/:id/aprobar')
  @Permiso('asistencia', 'administrar')
  aprobar(@Param('id') id: string, @Body() dto: RevisarMarcaDto, @Req() req: any) {
    return this.asistencia.revisarMarca(Number(id), 'APROBAR', dto, req.usuario, ipDe(req));
  }

  /** Anular una marca (no cuenta; la fila y el motivo se conservan). */
  @Post('marcas/:id/anular')
  @Permiso('asistencia', 'administrar')
  anular(@Param('id') id: string, @Body() dto: RevisarMarcaDto, @Req() req: any) {
    return this.asistencia.revisarMarca(Number(id), 'ANULAR', dto, req.usuario, ipDe(req));
  }

  /** «Separar» una doble marca: el admin la aprueba como marca propia (ya no se une a la anterior). */
  @Post('marcas/:id/separar')
  @Permiso('asistencia', 'administrar')
  separar(@Param('id') id: string, @Body() dto: RevisarMarcaDto, @Req() req: any) {
    return this.asistencia.revisarMarca(Number(id), 'SEPARAR', dto, req.usuario, ipDe(req));
  }

  /** Cambiar el rol de una marca (entrada, salida, break): anula la original y crea una corrección a la misma hora. */
  @Post('marcas/:id/reasignar')
  @Permiso('asistencia', 'administrar')
  reasignar(@Param('id') id: string, @Body() dto: ReasignarMarcaDto, @Req() req: any) {
    return this.asistencia.reasignarMarca(Number(id), dto, req.usuario, ipDe(req));
  }

  /** Cronograma por rango (máx. 31 días): por persona, horario, marcas interpretadas, tramos y solicitudes pendientes. */
  @Get('cronograma')
  @Permiso('asistencia', 'administrar')
  cronograma(@Query() q: CronogramaDto) {
    return this.correcciones.cronograma(q);
  }

  /** Bandeja «Solicitudes de corrección»: pendientes y jornadas con inconsistencia sin solicitud. */
  @Get('solicitudes')
  @Permiso('asistencia', 'administrar')
  solicitudes() {
    return this.correcciones.bandeja();
  }

  /** Solo el número de solicitudes pendientes (contador de la pestaña). */
  @Get('solicitudes/contador')
  @Permiso('asistencia', 'administrar')
  async contadorSolicitudes() {
    return { pendientes: await this.correcciones.contarPendientes() };
  }

  /** Aprobar o rechazar/anular varias a la vez (máx. 200). Devuelve el resultado de cada una. */
  @Post('lote')
  @Permiso('asistencia', 'administrar')
  lote(@Body() dto: LoteDto, @Req() req: any) {
    return this.correcciones.lote(dto, req.usuario, ipDe(req));
  }

  /** Resumen de pago: aprobar de golpe las marcas dudosas simples y las solicitudes pendientes del período de una persona. */
  @Post('aprobar-simples')
  @Permiso('asistencia', 'administrar')
  aprobarSimples(@Body() dto: AprobarSimplesDto, @Req() req: any) {
    return this.correcciones.aprobarSimples(dto.partyId, dto.desde, dto.hasta, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/aprobar')
  @Permiso('asistencia', 'administrar')
  aprobarSolicitud(@Param('id') id: string, @Body() dto: ResolverSolicitudDto, @Req() req: any) {
    return this.correcciones.aprobarSolicitud(Number(id), dto.nota, req.usuario, ipDe(req));
  }

  @Post('solicitudes/:id/rechazar')
  @Permiso('asistencia', 'administrar')
  rechazarSolicitud(@Param('id') id: string, @Body() dto: RechazarSolicitudDto, @Req() req: any) {
    return this.correcciones.rechazarSolicitud(Number(id), dto.motivo, req.usuario, ipDe(req));
  }

  @Post('dispositivos/:partyId/reiniciar')
  @Permiso('asistencia', 'administrar')
  reiniciar(@Param('partyId') partyId: string, @Req() req: any) {
    return this.asistencia.reiniciarDispositivo(Number(partyId), req.usuario, ipDe(req));
  }

  @Get('config')
  @Permiso('asistencia', 'administrar')
  config() {
    return this.asistencia.obtenerConfig();
  }

  @Put('config')
  @Permiso('asistencia', 'administrar')
  guardarConfig(@Body() dto: ConfigurarAsistenciaDto, @Req() req: any) {
    return this.asistencia.guardarConfig(dto, req.usuario, ipDe(req));
  }
}
