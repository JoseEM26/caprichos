import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EditarPantallaDto, ListarPantallasDto, VincularPantallaDto } from './dto/pantallas.dto';
import { PantallasService } from './pantallas.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

@Controller('admin/pantallas')
@UseGuards(AccesoGuard)
export class PantallasController {
  constructor(private readonly pantallas: PantallasService) {}

  @Get()
  @Permiso('pantallas', 'ver')
  listar(@Query() f: ListarPantallasDto) {
    return this.pantallas.listar(f.q, f.estacion);
  }

  @Get('areas')
  @Permiso('pantallas', 'ver')
  areas() {
    return this.pantallas.areas();
  }

  @Post('vincular')
  @Permiso('pantallas', 'vincular')
  vincular(@Body() dto: VincularPantallaDto, @Req() req: any) {
    return this.pantallas.vincular(dto, req.usuario, ipDe(req));
  }

  @Post(':id/activar')
  @Permiso('pantallas', 'desactivar')
  activar(@Param('id') id: string, @Req() req: any) {
    return this.pantallas.cambiarEstado(id, true, req.usuario, ipDe(req));
  }

  @Post(':id/desactivar')
  @Permiso('pantallas', 'desactivar')
  desactivar(@Param('id') id: string, @Req() req: any) {
    return this.pantallas.cambiarEstado(id, false, req.usuario, ipDe(req));
  }

  @Put(':id')
  @Permiso('pantallas', 'vincular')
  editar(@Param('id') id: string, @Body() dto: EditarPantallaDto, @Req() req: any) {
    return this.pantallas.editar(id, dto, req.usuario, ipDe(req));
  }
}
