import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { SupervisorCodigoService } from './supervisor-codigo.service';

@Controller('admin/supervisor')
@UseGuards(AccesoGuard)
export class SupervisorCodigoController {
  constructor(private readonly supervisorCodigoService: SupervisorCodigoService) {}

  /**
   * Obtiene el código actual de 6 dígitos calculado por el servidor y los segundos restantes.
   * Exclusivo para rol ADMIN con permiso supervisor/ver_codigo.
   * Envía cabecera Cache-Control: no-store para evitar almacenamiento en cachés intermedias.
   */
  @Get('codigo')
  @Permiso('supervisor', 'ver_codigo')
  async obtenerCodigo(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const actual = await this.supervisorCodigoService.obtenerCodigoActual(req.usuario.partyId, ip);
    return { ...actual, bloqueados: await this.supervisorCodigoService.listarBloqueados().catch(() => []) };
  }

  /**
   * Genera el secreto criptográfico inicial de 20 bytes si el local aún no lo tiene.
   */
  @Post('generar-secreto')
  @Permiso('supervisor', 'ver_codigo')
  async generarSecreto(@Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.supervisorCodigoService.generarSecreto(req.usuario.partyId, ip);
  }

  /**
   * Rota el secreto criptográfico del supervisor, invalidando el anterior.
   */
  @Post('rotar-secreto')
  @Permiso('supervisor', 'ver_codigo')
  async rotarSecreto(@Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.supervisorCodigoService.rotarSecreto(req.usuario.partyId, ip);
  }

  /**
   * Indica si el local ya tiene un secreto configurado.
   */
  @Get('estado')
  @Permiso('supervisor', 'ver_codigo')
  async estadoConfiguracion() {
    const configurado = await this.supervisorCodigoService.tieneSecretoConfigurado();
    return { configurado };
  }

  /** Operadores con el código bloqueado por intentos fallidos. */
  @Get('bloqueados')
  @Permiso('supervisor', 'ver_codigo')
  async bloqueados() {
    return this.supervisorCodigoService.listarBloqueados();
  }

  /** Desbloquea el contador de intentos de un operador. */
  @Post('desbloquear')
  @Permiso('supervisor', 'ver_codigo')
  async desbloquear(@Body('operadorPartyId') operadorPartyId: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.supervisorCodigoService.desbloquearOperador(operadorPartyId, req.usuario.partyId, ip);
  }
}
