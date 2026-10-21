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

@Controller()
export class ArchivosController {
  constructor(private readonly archivosService: ArchivosService) {}

  @Post('admin/archivos')
  @UseGuards(AccesoGuard)
  @Permiso('archivos', 'subir')
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
  @Permiso('archivos', 'ver')
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
    res.setHeader('Content-Length', bytes);
    fs.createReadStream(rutaAbsoluta).pipe(res);
  }
}
