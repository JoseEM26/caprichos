import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { IniciativasService } from './iniciativas.service';
import { CrearIniciativaDto } from './dto/crear-iniciativa.dto';
import { CrearComentarioDto } from './dto/crear-comentario.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { FiltrarIniciativasDto } from './dto/filtrar-iniciativas.dto';

@Controller('admin/iniciativas')
@UseGuards(AccesoGuard)
export class IniciativasController {
  constructor(private readonly iniciativasService: IniciativasService) {}

  @Get('resumen')
  @Permiso('iniciativas', 'ver')
  async obtenerResumen() {
    return this.iniciativasService.obtenerConteoNuevas();
  }

  @Get()
  @Permiso('iniciativas', 'ver')
  async listar(
    @Query() filtros: FiltrarIniciativasDto,
    @Req() req: any,
  ) {
    return this.iniciativasService.listar(filtros, req.usuario);
  }

  @Post()
  @Permiso('iniciativas', 'crear')
  async crear(
    @Body() dto: CrearIniciativaDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'];
    return this.iniciativasService.crear(dto, req.usuario, ip);
  }

  @Post(':id/comentarios')
  @Permiso('iniciativas', 'comentar')
  async comentar(
    @Param('id') id: string,
    @Body() dto: CrearComentarioDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'];
    return this.iniciativasService.comentar(id, dto, req.usuario, ip);
  }

  @Patch(':id/estado')
  @Permiso('iniciativas', 'cambiar_estado')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'];
    return this.iniciativasService.cambiarEstado(id, dto, req.usuario, ip);
  }
}
