import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ImpresionConfigService } from './impresion-config.service';
import { AsignarAreaEquipoDto, ReglasImpresionDto } from './dto/configuracion-impresion.dto';

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
    return this.config.asignarArea(id, dto?.areaId ?? null, req.usuario, ip);
  }

  @Put('reglas')
  @Permiso('configuracion', 'editar')
  async reglas(@Body() dto: ReglasImpresionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.config.guardarReglas(dto, req.usuario, ip);
  }
}
