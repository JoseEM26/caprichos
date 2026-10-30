import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { CambiarClaveUsuarioDto } from './dto/cambiar-clave-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { ConfigurarHorarioDto } from './dto/horario.dto';
import { AsignarPinDto } from './dto/asignar-pin.dto';
import { ConfigurarAlertasWhatsappDto } from './dto/configurar-alertas-whatsapp.dto';

@Controller('admin/usuarios')
@UseGuards(AccesoGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @Permiso('usuarios', 'ver')
  async listar(@Query() filtros: FiltrarUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  @Get('horarios')
  @Permiso('usuarios', 'ver')
  async listarHorarios() {
    return this.usuariosService.listarHorarios();
  }

  @Get(':id/horario')
  @Permiso('usuarios', 'ver')
  async obtenerHorario(@Param('id') id: string) {
    return this.usuariosService.obtenerHorario(id);
  }

  @Put(':id/horario')
  @Permiso('usuarios', 'editar')
  async configurarHorario(@Param('id') id: string, @Body() dto: ConfigurarHorarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.configurarHorario(id, dto, req.usuario, ip);
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

  /** Solo ADMIN (lo exige el servicio). Sin clave anterior; exige la clave del administrador que opera. */
  @Post(':id/clave')
  @Permiso('usuarios', 'editar')
  async cambiarClave(@Param('id') id: string, @Body() dto: CambiarClaveUsuarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.cambiarClaveAdmin(id, dto, req.usuario, ip);
  }

  /** Solo ADMIN. Misma regla de tamaño y tipo que la foto de Mi perfil. */
  @Put(':id/foto')
  @Permiso('usuarios', 'editar')
  @UseInterceptors(FileInterceptor('foto'))
  async cambiarFoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.cambiarFotoUsuario(id, file, req.usuario, ip);
  }

  /** Solo ADMIN. Desvincula la foto; el archivo queda en disco. */
  @Delete(':id/foto')
  @Permiso('usuarios', 'editar')
  async quitarFoto(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.quitarFotoUsuario(id, req.usuario, ip);
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

  @Get(':id/alertas-whatsapp')
  @Permiso('usuarios', 'ver')
  async obtenerAlertasWhatsapp(@Param('id') id: string) {
    return this.usuariosService.obtenerAlertasWhatsapp(id);
  }

  @Put(':id/alertas-whatsapp')
  @Permiso('usuarios', 'editar')
  async configurarAlertasWhatsapp(
    @Param('id') id: string,
    @Body() dto: ConfigurarAlertasWhatsappDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.configurarAlertasWhatsapp(id, dto, req.usuario, ip);
  }

  @Post(':id/alertas-whatsapp/enviar-prueba')
  @Permiso('usuarios', 'editar')
  async enviarPruebaAlertasWhatsapp(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.enviarPruebaAlertasWhatsapp(id, req.usuario, ip);
  }

  // La confirmación del número solo ocurre desde el botón «Sí, soy yo» que la persona pulsa en su WhatsApp;
  // no hay endpoint manual para que otro usuario del panel la dé por hecha.
}
