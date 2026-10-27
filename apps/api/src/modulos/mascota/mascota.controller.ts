import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { MascotaService } from './mascota.service';
import { ActualizarMascotaConfigDto } from './dto/actualizar-mascota.dto';
import { AspectoResuelto, MascotaAdminResponse } from './mascota.tipos';

function extraerIp(req: any): string | undefined {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
}

// =========================================================================
// ENDPOINT PÚBLICO (GET /carta/mascota) - CARTA VIRTUAL Y GENERAL
// =========================================================================
@Controller('carta/mascota')
export class CartaMascotaController {
  constructor(private readonly mascotaService: MascotaService) {}

  /**
   * GET /carta/mascota
   * Público, sin guard, cacheable 5 min (300 segundos).
   * Retorna el aspecto RESUELTO de hoy {tema, aspecto} ya fusionado base+tema.
   */
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  async obtenerAspecto(): Promise<AspectoResuelto> {
    return this.mascotaService.obtenerAspectoPublico();
  }
}

// =========================================================================
// ENDPOINTS ADMINISTRATIVOS (GET, PUT, POST /admin/mascota) - SOLO ADMIN
// =========================================================================
@Controller('admin/mascota')
@UseGuards(AccesoGuard)
export class MascotaAdminController {
  constructor(private readonly mascotaService: MascotaService) {}

  /**
   * GET /admin/mascota
   * Permiso: mascota/ver (solo ADMIN).
   * Retorna la configuración completa (base, temas, modo, temaManual) + aspecto resuelto de hoy.
   */
  @Get()
  @Permiso('mascota', 'ver')
  async obtenerConfig(): Promise<MascotaAdminResponse> {
    return this.mascotaService.obtenerConfigAdmin();
  }

  /**
   * PUT /admin/mascota
   * Permiso: mascota/editar (solo ADMIN).
   * Guarda la configuración validada en parametro mascota_config con auditoría.
   */
  @Put()
  @Permiso('mascota', 'editar')
  async actualizarConfig(
    @Body() dto: ActualizarMascotaConfigDto,
    @Req() req: any,
  ): Promise<MascotaAdminResponse> {
    const ip = extraerIp(req);
    return this.mascotaService.actualizarConfig(dto, req.usuario, ip);
  }

  /**
   * POST /admin/mascota/restablecer
   * Permiso: mascota/editar (solo ADMIN).
   * Restablece la configuración a los valores de fábrica con auditoría.
   */
  @Post('restablecer')
  @Permiso('mascota', 'editar')
  async restablecerConfig(@Req() req: any): Promise<MascotaAdminResponse> {
    const ip = extraerIp(req);
    return this.mascotaService.restablecerConfig(req.usuario, ip);
  }
}
