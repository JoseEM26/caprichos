import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { FeriadoCrearDto, FeriadoEditarDto, FeriadosQueryDto } from './dto/feriado.dto';
import { FeriadosService } from './feriados.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Feriados (pago con recargo en la planilla): planilla/ver y planilla/administrar. */
@Controller('admin/feriados')
@UseGuards(AccesoGuard)
export class FeriadosController {
  constructor(private readonly feriados: FeriadosService) {}

  @Get()
  @Permiso('planilla', 'ver')
  listar(@Query() q: FeriadosQueryDto) {
    return this.feriados.listar(q.anio);
  }

  @Post()
  @Permiso('planilla', 'administrar')
  crear(@Body() dto: FeriadoCrearDto, @Req() req: any) {
    return this.feriados.crear(dto, req.usuario, ipDe(req));
  }

  @Patch(':id')
  @Permiso('planilla', 'administrar')
  editar(@Param('id') id: string, @Body() dto: FeriadoEditarDto, @Req() req: any) {
    return this.feriados.editar(Number(id), dto, req.usuario, ipDe(req));
  }
}
