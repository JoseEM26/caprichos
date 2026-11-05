import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { UsuariosAreasService } from './usuarios-areas.service';
import { AreasUsuarioDto } from './dto/areas-usuario.dto';

@Controller(['admin/usuarios', 'api/admin/usuarios'])
@UseGuards(AccesoGuard)
export class UsuariosAreasController {
  constructor(private readonly areas: UsuariosAreasService) {}

  @Get(':id/areas')
  @Permiso('usuarios', 'ver')
  async leer(@Param('id') id: string) {
    return this.areas.leer(id);
  }

  @Put(':id/areas')
  @Permiso('usuarios', 'editar')
  async guardar(@Param('id') id: string, @Body() dto: AreasUsuarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.areas.guardar(id, dto.areaIds, req.usuario, ip);
  }
}
