import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PlanoService } from './plano.service';
import { CrearPisoDto } from './dto/crear-piso.dto';
import { ActualizarPisoDto } from './dto/actualizar-piso.dto';
import { CrearElementoDto } from './dto/crear-elemento.dto';
import { ActualizarElementoDto } from './dto/actualizar-elemento.dto';

@Controller('admin/plano')
@UseGuards(AccesoGuard)
export class PlanoController {
  constructor(private readonly planoService: PlanoService) {}

  // =========================================================================
  // 1) CONSULTAS
  // =========================================================================

  @Get()
  @Permiso('plano', 'ver')
  async obtenerPlano() {
    return this.planoService.obtenerPlano();
  }

  @Get('mesas')
  @Permiso('plano', 'ver')
  async obtenerMesasActivas() {
    return this.planoService.obtenerMesasActivas();
  }

  // =========================================================================
  // 2) PISOS
  // =========================================================================

  @Post('pisos')
  @Permiso('plano', 'editar')
  async crearPiso(@Body() dto: CrearPisoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.crearPiso(dto, req.usuario, ip);
  }

  @Patch('pisos/:id')
  @Permiso('plano', 'editar')
  async actualizarPiso(
    @Param('id') id: string,
    @Body() dto: ActualizarPisoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.actualizarPiso(id, dto, req.usuario, ip);
  }

  // =========================================================================
  // 3) ELEMENTOS
  // =========================================================================

  @Post('elementos')
  @Permiso('plano', 'editar')
  async crearElemento(@Body() dto: CrearElementoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.crearElemento(dto, req.usuario, ip);
  }

  @Post('elementos/:id/girar')
  @Permiso('plano', 'editar')
  async girarElemento(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.girarElemento(id, req.usuario, ip);
  }

  @Patch('elementos/:id')
  @Permiso('plano', 'editar')
  async actualizarElemento(
    @Param('id') id: string,
    @Body() dto: ActualizarElementoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.actualizarElemento(id, dto, req.usuario, ip);
  }

  @Delete('elementos/:id')
  @Permiso('plano', 'editar')
  async eliminarElemento(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.eliminarElemento(id, req.usuario, ip);
  }

  // =========================================================================
  // 4) DISEÑO COMPLETO
  // =========================================================================

  @Get('diseno')
  @Permiso('plano', 'ver')
  async obtenerDiseno() {
    return this.planoService.obtenerDiseno();
  }

  @Put('diseno')
  @Permiso('plano', 'editar')
  async aplicarDiseno(@Body() body: any, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.planoService.aplicarDiseno(body, req.usuario, ip);
  }
}
