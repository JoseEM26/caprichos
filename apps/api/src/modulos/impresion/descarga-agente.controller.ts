import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Res } from '@nestjs/common';
import * as fs from 'fs';
import { ImpresionService } from './impresion.service';

/** Ruta del .exe de Windows que sube el pipeline al volumen de la API. */
export const RUTA_EXE_WINDOWS =
  process.env.AGENTE_EXE_RUTA || '/data/descargas/agente-impresion-windows.exe';

/** Rutas públicas del programa del local: descarga del instalador y canje del código de vinculación. */
@Controller(['agente-impresion', 'api/agente-impresion'])
export class DescargaAgenteController {
  constructor(private readonly impresionService: ImpresionService) {}

  @Get('descargar/windows')
  descargarWindows(@Res() res: any) {
    if (!fs.existsSync(RUTA_EXE_WINDOWS)) {
      throw new NotFoundException({
        codigo: 'PROGRAMA_NO_PUBLICADO',
        mensaje: 'El programa de impresión para Windows aún no está publicado en este servidor.',
      });
    }
    res.download(RUTA_EXE_WINDOWS, 'agente-impresion-windows.exe');
  }

  @Post('vincular')
  @HttpCode(HttpStatus.OK)
  vincular(@Body() body: { codigo?: string }) {
    return this.impresionService.vincularAgente(body?.codigo || '');
  }
}
