import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { PuntosService } from './puntos.service';
import { ClientesService } from './clientes.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { RecuperarClaveService } from './recuperar-clave.service';
import { CodigoRegistroService } from './codigo-registro.service';
import { IngresoClienteDto, PerfilClienteDto, RegistroClienteDto } from './clientes.tipos';

@Controller('carta/cuenta')
export class CuentaClienteController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly configService: ConfigService,
    private readonly direcciones: DireccionesClienteService,
    private readonly puntos: PuntosService,
    private readonly recuperar: RecuperarClaveService,
    private readonly codigoRegistro: CodigoRegistroService,
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

  /** Envía por WhatsApp el código de 6 dígitos que pide crear la cuenta. Errores: CUENTA_EXISTENTE (409) y DEMASIADOS_CODIGOS (429). */
  @Post('registro/codigo')
  @HttpCode(200)
  async solicitarCodigoRegistro(@Body('telefono') telefono: string, @Req() req: Request) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.codigoRegistro.solicitar(telefono, ip);
  }

  /** Paso 2 de crear cuenta (o ver tus puntos): confirma el código de 6 dígitos que llegó por WhatsApp. */
  @Post('registro/verificar')
  @HttpCode(200)
  async verificarCodigoRegistro(@Body() dto: { telefono: string; codigo: string }) {
    return this.codigoRegistro.verificar(dto.telefono, dto.codigo);
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

  /** Pide un código de 6 dígitos por WhatsApp. Responde siempre lo mismo, exista o no la cuenta. */
  @Post('recuperar/solicitar')
  @HttpCode(200)
  async solicitarRecuperacion(@Body('telefono') telefono: string, @Req() req: Request) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.recuperar.solicitar(telefono, ip);
  }

  @Post('recuperar/confirmar')
  @HttpCode(200)
  async confirmarRecuperacion(
    @Body() dto: { telefono: string; codigo: string; contrasenaNueva: string },
    @Req() req: Request,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.recuperar.confirmar(dto, ip);
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

  @Get('direcciones')
  async listarDirecciones(@Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      return { direcciones: [] };
    }
    return { direcciones: await this.direcciones.listar(cliente.partyId) };
  }

  @Delete('direcciones/:id')
  async desactivarDireccion(@Param('id') id: string, @Req() req: Request) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({
        codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para quitar una dirección.',
      });
    }
    return this.direcciones.desactivar(cliente.partyId, id);
  }

  @Get('puntos/movimientos')
  async movimientosPuntos(@Req() req: Request, @Query('pagina') pagina?: string) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({ codigo: 'SESION_REQUERIDA', mensaje: 'Ingresa con tu celular para ver tus puntos.' });
    }
    return this.puntos.movimientosCuenta(BigInt(cliente.partyId), Math.max(1, parseInt(pagina ?? '1', 10) || 1));
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
