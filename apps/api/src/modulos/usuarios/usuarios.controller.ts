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
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { EditarUsuarioDto } from './dto/editar-usuario.dto';
import { CambiarClaveUsuarioDto } from './dto/cambiar-clave-usuario.dto';
import { FiltrarUsuariosDto } from './dto/filtrar-usuarios.dto';
import { ConfigurarHorarioDto } from './dto/horario.dto';
import { ConfigurarAlertasWhatsappDto } from './dto/configurar-alertas-whatsapp.dto';
import { DesactivarUsuarioDto } from './dto/desactivar-usuario.dto';
import { ReactivarUsuarioDto } from './dto/reactivar-usuario.dto';
import { EditarPeriodoDto } from './dto/editar-periodo.dto';
import { OtorgarRolExtraDto } from './dto/rol-temporal.dto';
import { UsuariosRolesService } from './usuarios-roles.service';
import { UsuariosPermisosService } from './usuarios-permisos.service';
import { PermisosExtraDto } from './dto/permisos-extra.dto';
import { UsuariosRolesMasivoService } from './usuarios-roles-masivo.service';
import { RolesMasivoDto } from './dto/roles-masivo.dto';
import { UsuariosActividadService } from './usuarios-actividad.service';
import { UsuariosAccesosService } from './usuarios-accesos.service';
import { UsuariosRolesModulosService } from './usuarios-roles-modulos.service';
import { GuardarRolModulosDto } from './dto/roles-modulos.dto';

@Controller('admin/usuarios')
@UseGuards(AccesoGuard)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly rolesService: UsuariosRolesService,
    private readonly permisosService: UsuariosPermisosService,
    private readonly rolesMasivoService: UsuariosRolesMasivoService,
    private readonly actividadService: UsuariosActividadService,
    private readonly accesosService: UsuariosAccesosService,
    private readonly rolesModulosService: UsuariosRolesModulosService,
  ) {}

  /** Módulos que ve cada rol hoy y cuáles son ajuste del dueño (solo ADMIN). */
  @Get('roles-modulos')
  @Permiso('usuarios', 'administrar_roles')
  async rolesModulos() {
    return this.rolesModulosService.listar();
  }

  /** Guarda los módulos de un rol como ajustes sobre la base del sistema y los aplica (solo ADMIN, auditado). */
  @Put('roles-modulos/:rol')
  @Permiso('usuarios', 'administrar_roles')
  async guardarRolModulos(@Param('rol') rol: string, @Body() dto: GuardarRolModulosDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.rolesModulosService.guardarModulos(rol, dto.modulos, req.usuario, ip);
  }

  /** Borra los ajustes del rol y lo devuelve a la base del sistema. */
  @Post('roles-modulos/:rol/restablecer')
  @Permiso('usuarios', 'administrar_roles')
  async restablecerRolModulos(@Param('rol') rol: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.rolesModulosService.restablecer(rol, req.usuario, ip);
  }

  /** Agrega o quita un rol EXTRA a varios usuarios (o a todos). Solo ADMIN; reporta quién se omitió y por qué. */
  @Post('roles-masivo')
  @Permiso('usuarios', 'editar')
  async rolesMasivo(@Body() dto: RolesMasivoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.rolesMasivoService.aplicar(dto, req.usuario, ip);
  }

  /** Da un rol extra (temporal si trae fecha de fin). Solo ADMIN; queda en el historial de roles. */
  @Post(':id/roles-extra')
  @Permiso('usuarios', 'editar')
  async otorgarRol(@Param('id') id: string, @Body() dto: OtorgarRolExtraDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.rolesService.otorgar(id, dto, req.usuario, ip);
  }

  /** Quita un rol extra (temporal o permanente) cuando el ADMIN quiera. Solo ADMIN. */
  @Delete(':id/roles-extra/:rol')
  @Permiso('usuarios', 'editar')
  async retirarRol(@Param('id') id: string, @Param('rol') rol: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.rolesService.retirar(id, rol, req.usuario, ip);
  }

  /** Roles, permisos extra y permisos efectivos de una persona, por módulo en lenguaje llano. */
  @Get(':id/permisos')
  @Permiso('usuarios', 'ver')
  async permisos(@Param('id') id: string) {
    return this.permisosService.obtener(id);
  }

  /** Reemplaza los permisos extra de la persona (aditivos a sus roles). Solo ADMIN; auditado. */
  @Put(':id/permisos-extra')
  @Permiso('usuarios', 'editar')
  async reemplazarPermisosExtra(@Param('id') id: string, @Body() dto: PermisosExtraDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.permisosService.reemplazar(id, dto, req.usuario, ip);
  }

  /** Línea de tiempo de una persona: cambios de su cuenta, roles, horario, asistencia y lo que hizo. Solo ADMIN. */
  @Get(':id/actividad')
  @Permiso('usuarios', 'ver')
  async actividad(
    @Param('id') id: string,
    @Query('tipo') tipo: string,
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
    @Query('pagina') pagina: string,
    @Query('limite') limite: string,
    @Req() req: any,
  ) {
    return this.actividadService.listar(
      id,
      { tipo, desde, hasta, pagina: Number(pagina) || undefined, limite: Number(limite) || undefined },
      req.usuario,
    );
  }

  @Get()
  @Permiso('usuarios', 'ver')
  async listar(@Query() filtros: FiltrarUsuariosDto) {
    return this.usuariosService.listar(filtros);
  }

  /** Cuadro de accesos: roles y permisos efectivos de cada persona (solo ADMIN). Sin datos sensibles. */
  @Get('accesos-modulos')
  @Permiso('usuarios', 'ver_accesos')
  async accesosModulos(@Query('inactivos') inactivos?: string) {
    return this.accesosService.listar(inactivos === 'true');
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
  async desactivar(@Param('id') id: string, @Body() dto: DesactivarUsuarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.desactivar(id, req.usuario, ip, dto ?? {});
  }

  @Post(':id/reactivar')
  @Permiso('usuarios', 'reactivar')
  async reactivar(@Param('id') id: string, @Body() dto: ReactivarUsuarioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.reactivar(id, req.usuario, ip, dto ?? {});
  }

  /** Historial laboral: periodos, tiempo total, veces que salió y licencia. */
  @Get(':id/periodos')
  @Permiso('usuarios', 'ver')
  async historial(@Param('id') id: string) {
    return this.usuariosService.historialLaboral(id);
  }

  /** Corrige un periodo (solo ADMIN). */
  @Patch(':id/periodos/:periodoId')
  @Permiso('usuarios', 'editar')
  async editarPeriodo(@Param('id') id: string, @Param('periodoId') periodoId: string, @Body() dto: EditarPeriodoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.usuariosService.editarPeriodo(id, periodoId, dto, req.usuario, ip);
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
