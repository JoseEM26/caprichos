import { Body, Controller, Get, Ip, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ResenasGoogleService } from './resenas-google.service';
import { BuscarNegocioDto, CargaInicialDto, GuardarNegocioDto, VisibleLoteDto, VisibleResenaDto } from './dto/resenas.dto';

@Controller('admin/resenas')
@UseGuards(AccesoGuard)
export class ResenasAdminController {
  constructor(private readonly resenas: ResenasGoogleService) {}

  @Get()
  @Permiso('resenas', 'ver')
  async listar() {
    return this.resenas.listarAdmin();
  }

  @Post('buscar-negocio')
  @Permiso('resenas', 'editar')
  async buscarNegocio(@Body() dto: BuscarNegocioDto) {
    return this.resenas.buscarNegocio(dto.consulta);
  }

  @Put('negocio')
  @Permiso('resenas', 'editar')
  async guardarNegocio(@Body() dto: GuardarNegocioDto, @Req() req: any, @Ip() ip: string) {
    return this.resenas.guardarNegocio(dto.businessId, dto.nombre, req.usuario, ip, dto.rating, dto.total, dto.enlaceLocal);
  }

  @Post('carga-inicial')
  @Permiso('resenas', 'editar')
  async cargaInicial(@Body() dto: CargaInicialDto, @Req() req: any, @Ip() ip: string) {
    return this.resenas.cargaInicial({ repetir: dto.repetir === true, usuario: req.usuario, ip });
  }

  @Post('actualizar')
  @Permiso('resenas', 'editar')
  async actualizar(@Req() req: any, @Ip() ip: string) {
    return this.resenas.actualizar({ manual: true, usuario: req.usuario, ip });
  }

  // Va antes de PATCH :id para que «visibilidad» no se tome como un id
  @Patch('visibilidad')
  @Permiso('resenas', 'editar')
  async cambiarVisibleLote(@Body() dto: VisibleLoteDto, @Req() req: any, @Ip() ip: string) {
    return this.resenas.cambiarVisibleLote(dto.ids, dto.visible, req.usuario, ip);
  }

  @Patch(':id')
  @Permiso('resenas', 'editar')
  async cambiarVisible(@Param('id') id: string, @Body() dto: VisibleResenaDto, @Req() req: any, @Ip() ip: string) {
    return this.resenas.cambiarVisible(id, dto.visible, req.usuario, ip);
  }
}
