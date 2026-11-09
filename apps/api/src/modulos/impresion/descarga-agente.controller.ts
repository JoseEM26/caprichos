import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, Res } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VincularAgenteDto } from './dto/latido.dto';
import { ImpresionService } from './impresion.service';

/** Archivos que sube el pipeline al volumen de la API, por sistema. */
export const PROGRAMAS: Record<string, { ruta: () => string; nombre: string; etiqueta: string }> = {
  windows: {
    ruta: () => process.env.AGENTE_EXE_RUTA || '/data/descargas/agente-impresion-windows.exe',
    nombre: 'agente-impresion-windows.exe',
    etiqueta: 'Windows',
  },
  linux: {
    ruta: () => process.env.AGENTE_LINUX_RUTA || '/data/descargas/agente-impresion-linux',
    nombre: 'agente-impresion-linux',
    etiqueta: 'Linux',
  },
};

/** version-agente.json lo sube el pipeline junto al programa: {version, commit, fecha}. */
export function rutaVersionPrograma(): string {
  return process.env.AGENTE_VERSION_RUTA || path.join(path.dirname(PROGRAMAS.windows.ruta()), 'version-agente.json');
}

/** Rutas públicas del programa del local: descarga del instalador y canje del código de vinculación. */
@Controller(['agente-impresion', 'api/agente-impresion'])
export class DescargaAgenteController {
  constructor(private readonly impresionService: ImpresionService) {}

  /** Última versión publicada del programa; sin archivo, `{ publicada: null }` (la web no muestra insignia). */
  @Get('version')
  version() {
    try {
      const j = JSON.parse(fs.readFileSync(rutaVersionPrograma(), 'utf-8'));
      if (typeof j?.version !== 'string') return { publicada: null };
      return { publicada: { version: j.version, commit: j.commit ?? null, fecha: j.fecha ?? null } };
    } catch {
      return { publicada: null };
    }
  }

  @Get('descargar/:sistema')
  descargar(@Param('sistema') sistema: string, @Res() res: any) {
    const p = PROGRAMAS[sistema];
    if (!p) throw new NotFoundException({ codigo: 'SISTEMA_NO_SOPORTADO', mensaje: 'Sistema no soportado: usa windows o linux.' });
    if (!fs.existsSync(p.ruta())) {
      throw new NotFoundException({
        codigo: 'PROGRAMA_NO_PUBLICADO',
        mensaje: `El programa de impresión para ${p.etiqueta} aún no está publicado en este servidor.`,
      });
    }
    res.download(p.ruta(), p.nombre);
  }

  @Post('vincular')
  @HttpCode(HttpStatus.OK)
  vincular(@Body() body: VincularAgenteDto) {
    return this.impresionService.vincularAgente(body?.codigo || '', body?.equipo);
  }
}
