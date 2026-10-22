import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ClientesService } from './clientes.service';
import { IngresoClienteDto, RegistroClienteDto } from './clientes.tipos';

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
