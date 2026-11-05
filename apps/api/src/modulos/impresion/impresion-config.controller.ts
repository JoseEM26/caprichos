import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ImpresionConfigService } from './impresion-config.service';
import { AsignarAreaEquipoDto, ReemplazarEquipoDto, ReglasImpresionDto } from './dto/configuracion-impresion.dto';

@Controller(['admin/impresion', 'api/admin/impresion'])
@UseGuards(AccesoGuard)
export class ImpresionConfigController {
  constructor(private readonly config: ImpresionConfigService) {}

  @Get('mapa')
  @Permiso('configuracion', 'ver')
  async mapa() {
    return this.config.obtenerMapa();
  }

  @Put('equipos/:id/area')
  @Permiso('configuracion', 'editar')
  async asignarArea(@Param('id') id: string, @Body() dto: AsignarAreaEquipoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.config.asignarArea(id, dto?.areaId ?? null, req.usuario, ip, dto?.reemplazar === true);
  }

  /** El equipo de la ruta (el viejo) cede su área al de `porEquipoId` (el nuevo); el viejo se desactiva. */
  @Post('equipos/:id/reemplazar')
  @Permiso('configuracion', 'editar')
  async reemplazarEquipo(@Param('id') id: string, @Body() dto: ReemplazarEquipoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.config.reemplazarEquipo(id, dto.porEquipoId, req.usuario, ip);
  }

  /** Deja solo este equipo en su área (o en Caja): desactiva los duplicados que chocan con él. */
  @Post('equipos/:id/quedarse')
  @Permiso('configuracion', 'editar')
  async quedarse(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.config.quedarseCon(id, req.usuario, ip);
  }

  @Put('reglas')
  @Permiso('configuracion', 'editar')
  async reglas(@Body() dto: ReglasImpresionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.config.guardarReglas(dto, req.usuario, ip);
  }
}
