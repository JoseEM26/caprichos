import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CorreosExtraService } from './correos-extra.service';

export class CorreoExtraDto {
  @IsOptional() @IsString() @MaxLength(160) correo?: string;
  @IsOptional() @IsString() @MaxLength(80) etiqueta?: string | null;
  @IsOptional() @IsBoolean() activo?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) tipos?: string[];
}

const soloAdmin = (req: any) => {
  if (req.usuario?.rol !== 'ADMIN') {
    throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador maneja los correos de aviso' });
  }
};
const ip = (req: any) => (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;

@Controller('admin/correos-aviso')
@UseGuards(AccesoGuard)
export class CorreosExtraController {
  constructor(private readonly servicio: CorreosExtraService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  listar(@Req() req: any) {
    soloAdmin(req);
    return this.servicio.listar();
  }

  @Post()
  @Permiso('configuracion', 'editar')
  crear(@Body() dto: CorreoExtraDto, @Req() req: any) {
    soloAdmin(req);
    return this.servicio.crear(dto, req.usuario, ip(req));
  }

  @Patch(':id')
  @Permiso('configuracion', 'editar')
  actualizar(@Param('id') id: string, @Body() dto: CorreoExtraDto, @Req() req: any) {
    soloAdmin(req);
    return this.servicio.actualizar(id, dto, req.usuario, ip(req));
  }

  @Delete(':id')
  @Permiso('configuracion', 'editar')
  eliminar(@Param('id') id: string, @Req() req: any) {
    soloAdmin(req);
    return this.servicio.eliminar(id, req.usuario, ip(req));
  }

  @Post(':id/prueba')
  @Permiso('configuracion', 'editar')
  probar(@Param('id') id: string, @Req() req: any) {
    soloAdmin(req);
    return this.servicio.probar(id, req.usuario, ip(req));
  }
}
