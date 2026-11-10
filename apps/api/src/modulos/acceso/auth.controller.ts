import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CambiarContrasenaDto, IngresarDto } from './auth.dto';
import { AccesoGuard } from './acceso.guard';
import { SoloCambioClave } from './permiso.decorator';
import { UsuarioAutenticado } from './acceso.tipos';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('ingresar')
  async ingresar(
    @Body() dto: IngresarDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers['user-agent'] as string | undefined;

    const resultado = await this.authService.ingresar(dto, ip, dispositivo);

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('refreshToken', resultado.rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: resultado.maxAgeMs,
    });

    return resultado.respuesta;
  }

  @Post('renovar')
  async renovar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefreshToken?: string,
  ) {
    const rawRefreshToken =
      req.cookies?.['refreshToken'] ||
      req.cookies?.['refresh_token'] ||
      bodyRefreshToken;

    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers['user-agent'] as string | undefined;

    const resultado = await this.authService.renovar(
      rawRefreshToken,
      ip,
      dispositivo,
    );

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('refreshToken', resultado.rawRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: resultado.maxAgeMs,
    });

    return resultado.respuesta;
  }

  @Post('salir')
  async salir(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken =
      req.cookies?.['refreshToken'] || req.cookies?.['refresh_token'];
    const usuario = (req as any).usuario as UsuarioAutenticado | undefined;
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers['user-agent'] as string | undefined;

    const resultado = await this.authService.salir(
      rawRefreshToken,
      usuario?.partyId,
      ip,
      dispositivo,
    );

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/',
    });

    return resultado;
  }

  /** Cierra todas las sesiones abiertas de quien lo pide (por si dejó la sesión en otro equipo). */
  @UseGuards(AccesoGuard)
  @SoloCambioClave()
  @Post('salir-todas')
  async salirTodas(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const usuario = (req as any).usuario as UsuarioAutenticado;
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers['user-agent'] as string | undefined;
    const resultado = await this.authService.salirTodas(usuario.partyId, ip, dispositivo);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    for (const nombre of ['refreshToken', 'refresh_token']) {
      res.clearCookie(nombre, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
    }
    return resultado;
  }

  @UseGuards(AccesoGuard)
  @SoloCambioClave()
  @Get('yo')
  async yo(@Req() req: Request) {
    const usuario = (req as any).usuario as UsuarioAutenticado;
    return this.authService.yo(usuario.partyId);
  }

  @UseGuards(AccesoGuard)
  @SoloCambioClave()
  @Post('cambiar-contrasena')
  async cambiarContrasena(
    @Body() dto: CambiarContrasenaDto,
    @Req() req: Request,
  ) {
    const usuario = (req as any).usuario as UsuarioAutenticado;
    const rawRefreshToken =
      req.cookies?.['refreshToken'] || req.cookies?.['refresh_token'];
    const ip = (req.ip || req.headers['x-forwarded-for']) as string | undefined;
    const dispositivo = req.headers['user-agent'] as string | undefined;

    return this.authService.cambiarContrasena(
      usuario.partyId,
      dto,
      rawRefreshToken,
      ip,
      dispositivo,
    );
  }
}
