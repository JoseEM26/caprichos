import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ClientesService } from './clientes.service';
import { IngresoClienteDto, PerfilClienteDto, RegistroClienteDto } from './clientes.tipos';

@Controller('carta/cuenta')
export class CuentaClienteController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly configService: ConfigService,
  ) {}

  @Post('registro')
  async registro(
    @Body() dto: RegistroClienteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const { cliente, token } = await this.clientesService.registro(dto, ip);

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('cp_cliente', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    return { cliente };
  }

  @Post('ingresar')
  async ingresar(
    @Body() dto: IngresoClienteDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const { cliente, token } = await this.clientesService.ingresar(dto, ip);

    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('cp_cliente', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProduction,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
    });

    return { cliente };
  }

  @Get('yo')
  async yo(@Req() req: Request) {
    // NUNCA 401: el front de la carta ya maneja 401 como sesión administrativa
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    return { cliente };
  }

  @Post('salir')
  async salir(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('cp_cliente', {
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
    });
    return { ok: true };
  }

  @Put('perfil')
  async actualizarPerfil(@Body() dto: PerfilClienteDto, @Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({
        codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para editar tu perfil.',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const actualizado = await this.clientesService.actualizarPerfil(cliente.partyId, dto, ip);
    return { cliente: actualizado };
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('foto'))
  async subirFoto(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({
        codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para cambiar tu foto.',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const actualizado = await this.clientesService.subirFoto(cliente.partyId, file, ip);
    return { cliente: actualizado };
  }

  @Delete('foto')
  async quitarFoto(@Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({
        codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para quitar tu foto.',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const actualizado = await this.clientesService.quitarFoto(cliente.partyId, ip);
    return { cliente: actualizado };
  }

  @Get('notificaciones')
  async notificaciones(@Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      return { notificaciones: [] };
    }
    const notificaciones = await this.clientesService.notificaciones(cliente.partyId);
    return { notificaciones };
  }

  @Post('cumpleanos')
  async guardarCumpleanos(
    @Body('cumpleanos') cumpleanos: string,
    @Req() req: Request,
  ) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      return { ok: false, mensaje: 'Sin sesión' };
    }
    return this.clientesService.guardarCumpleanos(cliente.partyId, cumpleanos);
  }
}
