import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ConfigurarAsistenciaDto, CorregirMarcaDto, ListarMarcasDto, ReporteMesDto } from './dto/asistencia.dto';
import { AsistenciaService } from './asistencia.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Pantalla del local y reportes: solo ADMIN (permiso asistencia/administrar), salvo la pantalla del QR. */
@Controller('admin/asistencia')
@UseGuards(AccesoGuard)
export class AsistenciaAdminController {
  constructor(private readonly asistencia: AsistenciaService) {}

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
