import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EquipoConfigService } from './equipo-config.service';

/** Qué imprime cada computadora, gestionable desde el panel sin estar en el local. */
@Controller(['admin/impresion/equipos', 'api/admin/impresion/equipos'])
@UseGuards(AccesoGuard)
export class EquipoConfigController {
  constructor(private readonly equipos: EquipoConfigService) {}

  private ip(req: any): string | undefined {
    return (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  }

  @Get(':id/config')
  @Permiso('configuracion', 'ver')
  async obtener(@Param('id') id: string) {
    return this.equipos.obtener(id);
  }

  /** Cambio parcial (nombre, máquinas, qué imprime, áreas, tamaños, impresoras, pausa). La PC queda «configurada». */
  @Put(':id/config')
  @Permiso('configuracion', 'editar')
  async guardar(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: any) {
    return this.equipos.guardar(id, body ?? {}, req.usuario, this.ip(req));
  }

  @Post(':id/usar-general')
  @HttpCode(HttpStatus.OK)
  @Permiso('configuracion', 'editar')
  async usarGeneral(@Param('id') id: string, @Req() req: any) {
    return this.equipos.usarGeneral(id, req.usuario, this.ip(req));
  }

  /** «Imprimir prueba con este tamaño»: sticker de ejemplo a esa PC. */
  @Post(':id/prueba-etiqueta')
  @HttpCode(HttpStatus.OK)
  @Permiso('configuracion', 'editar')
  async pruebaEtiqueta(@Param('id') id: string, @Body() body: { tipo?: string; tamano?: unknown }, @Req() req: any) {
    return this.equipos.pruebaEtiqueta(id, body?.tipo as any, body?.tamano, req.usuario, this.ip(req));
  }
}
