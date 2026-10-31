import { Body, Controller, ForbiddenException, Get, Ip, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ResenasGoogleService } from './resenas-google.service';
import { BuscarNegocioDto, CargaInicialDto, GuardarNegocioDto, VisibleResenaDto } from './dto/resenas.dto';

function soloAdmin(req: any): void {
  if (req.usuario?.rol !== 'ADMIN') {
    throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede manejar las reseñas de Google' });
  }
}

@Controller('admin/resenas')
@UseGuards(AccesoGuard)
export class ResenasAdminController {
  constructor(private readonly resenas: ResenasGoogleService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  async listar(@Req() req: any) {
    soloAdmin(req);
    return this.resenas.listarAdmin();
  }

  @Post('buscar-negocio')
  @Permiso('configuracion', 'editar')
  async buscarNegocio(@Body() dto: BuscarNegocioDto, @Req() req: any) {
    soloAdmin(req);
    return this.resenas.buscarNegocio(dto.consulta);
  }

  @Put('negocio')
  @Permiso('configuracion', 'editar')
  async guardarNegocio(@Body() dto: GuardarNegocioDto, @Req() req: any, @Ip() ip: string) {
    soloAdmin(req);
    return this.resenas.guardarNegocio(dto.businessId, dto.nombre, req.usuario, ip, dto.rating, dto.total, dto.enlaceLocal);
  }

  @Post('carga-inicial')
  @Permiso('configuracion', 'editar')
  async cargaInicial(@Body() dto: CargaInicialDto, @Req() req: any, @Ip() ip: string) {
    soloAdmin(req);
    return this.resenas.cargaInicial({ repetir: dto.repetir === true, usuario: req.usuario, ip });
  }

  @Post('actualizar')
  @Permiso('configuracion', 'editar')
  async actualizar(@Req() req: any, @Ip() ip: string) {
    soloAdmin(req);
    return this.resenas.actualizar({ manual: true, usuario: req.usuario, ip });
  }

  @Patch(':id')
  @Permiso('configuracion', 'editar')
  async cambiarVisible(@Param('id') id: string, @Body() dto: VisibleResenaDto, @Req() req: any, @Ip() ip: string) {
    soloAdmin(req);
    return this.resenas.cambiarVisible(id, dto.visible, req.usuario, ip);
  }
}
