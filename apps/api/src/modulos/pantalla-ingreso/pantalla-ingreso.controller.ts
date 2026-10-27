import { Body, Controller, Get, Header, Put, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ActualizarPantallaIngresoDto } from './dto/actualizar-pantalla-ingreso.dto';
import { PantallaIngresoService } from './pantalla-ingreso.service';
import { PantallaIngresoAdmin, PantallaIngresoPublica } from './pantalla-ingreso.tipos';

/** Endpoint público (sin autenticación): imágenes y frase de la pantalla de ingreso. */
@Controller('carta/ingreso')
export class CartaIngresoController {
  constructor(private readonly pantallaIngreso: PantallaIngresoService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  async obtener(): Promise<PantallaIngresoPublica> {
    return this.pantallaIngreso.obtenerPublica();
  }
}

/** Administración: solo quien tiene configuracion/editar (ADMIN). */
@Controller('admin/pantalla-ingreso')
@UseGuards(AccesoGuard)
export class PantallaIngresoAdminController {
  constructor(private readonly pantallaIngreso: PantallaIngresoService) {}

  @Get()
  @Permiso('configuracion', 'editar')
  async obtener(): Promise<PantallaIngresoAdmin> {
    return this.pantallaIngreso.obtenerAdmin();
  }

  @Put()
  @Permiso('configuracion', 'editar')
  async actualizar(
    @Body() dto: ActualizarPantallaIngresoDto,
    @Req() req: any,
  ): Promise<PantallaIngresoAdmin> {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.pantallaIngreso.actualizar(dto, req.usuario, ip);
  }
}
