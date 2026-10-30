import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AccesoGuard } from './acceso.guard';
import { UsuarioAutenticado } from './acceso.tipos';
import { ActualizarMiPerfilDto, CAMPOS_MI_PERFIL } from './mi-perfil.dto';
import { MiPerfilService } from './mi-perfil.service';
import { SoloCambioClave } from './permiso.decorator';

/** Mi perfil: cualquier usuario autenticado edita SOLO su cuenta (partyId de la sesión, sin permiso de usuarios). */
@Controller('auth/perfil')
@UseGuards(AccesoGuard)
export class MiPerfilController {
  constructor(private readonly miPerfil: MiPerfilService) {}

  @Get()
  @SoloCambioClave()
  obtener(@Req() req: any) {
    return this.miPerfil.obtener((req.usuario as UsuarioAutenticado).partyId);
  }

  @Patch()
  async actualizar(@Body() dto: ActualizarMiPerfilDto, @Req() req: any) {
    // El ValidationPipe global ya descarta lo que no esté en el DTO; aquí se rechaza explícitamente
    // (rol, usuario, permisos, estado...) mirando el cuerpo original.
    const extra = Object.keys(req.body ?? {}).filter((k) => !(CAMPOS_MI_PERFIL as readonly string[]).includes(k));
    if (extra.length > 0) {
      throw new BadRequestException({
        codigo: 'CAMPO_NO_PERMITIDO',
        mensaje: `Estos datos no se pueden cambiar desde tu perfil: ${extra.join(', ')}`,
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.miPerfil.actualizarDatos((req.usuario as UsuarioAutenticado).partyId, dto, ip);
  }

  @Put('foto')
  @SoloCambioClave()
  @UseInterceptors(FileInterceptor('foto'))
  cambiarFoto(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.miPerfil.cambiarFoto(req.usuario as UsuarioAutenticado, file, ip);
  }

  @Delete('foto')
  @SoloCambioClave()
  quitarFoto(@Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.miPerfil.quitarFoto(req.usuario as UsuarioAutenticado, ip);
  }
}
