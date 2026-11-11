import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import * as fs from 'fs';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ArchivosService } from './archivos.service';
import { interpretarRango } from './rango-http.util';

@Controller()
export class ArchivosController {
  constructor(private readonly archivosService: ArchivosService) {}

  @Post('admin/archivos')
  @UseGuards(AccesoGuard)
  @Permiso([
    { modulo: 'archivos', accion: 'subir' },
    { modulo: 'iniciativas', accion: 'crear' },
  ])
  @UseInterceptors(FileInterceptor('archivo'))
  async subir(
    @UploadedFile() file: Express.Multer.File,
    @Body('privado') privadoRaw: any,
    @Req() req: any,
  ) {
    const privado = privadoRaw === true || privadoRaw === 'true' || privadoRaw === '1';
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.archivosService.subirArchivo(file, privado, req.usuario, ip);
  }

  @Get('archivos/publico/*')
  async servirPublico(@Req() req: Request, @Res() res: Response) {
    const urlPath = req.url.split('?')[0];
    const prefix = '/archivos/publico/';
    const relativePath = decodeURIComponent(
      urlPath.startsWith(prefix) ? urlPath.slice(prefix.length) : (req.params as any)[0] || '',
    );

    const rutaAbsoluta = this.archivosService.validarYSolucionarRutaPublica(relativePath);

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', 'image/webp');
    fs.createReadStream(rutaAbsoluta).pipe(res);
  }

  @Get('admin/archivos/:id')
  @UseGuards(AccesoGuard)
  @Permiso([
    { modulo: 'archivos', accion: 'ver' },
    { modulo: 'iniciativas', accion: 'ver' },
    { modulo: 'mensajes', accion: 'ver' },
  ])
  async servirPrivado(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers?.['user-agent'] as string | undefined;

    const { rutaAbsoluta, tipoMime, bytes } = await this.archivosService.obtenerArchivoPrivado(
      id,
      req.usuario,
      ip,
      dispositivo,
    );

    res.setHeader('Content-Type', tipoMime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Imágenes, audios y el PDF del voucher se ven en el panel; Word, Excel, texto, etc. solo se descargan.
    // Los documentos del chat se sirven por GET admin/mensajes/documentos/:id, siempre como descarga.
    if (!/^(image|audio)\//.test(tipoMime) && tipoMime !== 'application/pdf') res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    // Range: permite adelantar un audio sin bajarlo entero
    const rango = interpretarRango(req.headers?.range as string | undefined, bytes);
    if (rango === 'invalido') {
      res.status(416).setHeader('Content-Range', `bytes */${bytes}`);
      res.end();
      return;
    }
    if (rango) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${rango.inicio}-${rango.fin}/${bytes}`);
      res.setHeader('Content-Length', rango.fin - rango.inicio + 1);
      fs.createReadStream(rutaAbsoluta, { start: rango.inicio, end: rango.fin }).pipe(res);
      return;
    }
    res.setHeader('Content-Length', bytes);
    fs.createReadStream(rutaAbsoluta).pipe(res);
  }
}
