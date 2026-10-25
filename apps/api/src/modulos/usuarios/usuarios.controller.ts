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
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { AsignarPinDto } from './dto/asignar-pin.dto';

@Controller('admin/usuarios')
@UseGuards(AccesoGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Permiso('usuarios', 'ver')
  async listar(@Query() filtros: FiltrarUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  @Get(':id/dni')
  @Permiso('usuarios', 'ver')
  async obtenerDni(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.obtenerDni(id, req.usuario, ip);
  }

  @Post()
  @Permiso('usuarios', 'crear')
  async crear(@Body() dto: CrearUsuarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.crear(dto, req.usuario, ip);
  }

  @Patch(':id')
  @Permiso('usuarios', 'editar')
  @RequiereCodigoSupervisor('usuarios/cambiar_rol', {
    condicion: (req) => Boolean(req.body?.rol),
  })
  async editar(
    @Param('id') id: string,
    @Body() dto: EditarUsuarioDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.editar(id, dto, req.usuario, ip);
  }

  @Post(':id/desactivar')
  @Permiso('usuarios', 'desactivar')
  @RequiereCodigoSupervisor('usuarios/desactivar')
  async desactivar(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.desactivar(id, req.usuario, ip);
  }

  @Post(':id/reactivar')
  @Permiso('usuarios', 'reactivar')
  async reactivar(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.reactivar(id, req.usuario, ip);
  }

  @Post(':id/restablecer')
  @Permiso('usuarios', 'restablecer')
  async restablecerClave(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.restablecerClave(id, req.usuario, ip);
  }

  @Post(':id/pin')
  @Permiso('usuarios', 'editar')
  async asignarPin(
    @Param('id') id: string,
    @Body() dto: AsignarPinDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.asignarPin(id, dto, req.usuario, ip);
  }
}
