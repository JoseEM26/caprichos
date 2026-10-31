import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { DireccionesService } from './direcciones.service';

/** Pedido delivery de Caja y mozo: dirección aproximada de un punto del mapa (solo referencia, se puede corregir). */
@Controller('admin/direcciones')
@UseGuards(AccesoGuard)
export class DireccionesAdminController {
  constructor(private readonly direcciones: DireccionesService) {}

  @Get('inversa')
  @Permiso('pedidos', 'crear')
  async inversa(@Query('lat') lat?: string, @Query('lng') lng?: string) {
    const la = Number(lat);
    const ln = Number(lng);
    if (lat === undefined || lng === undefined || !Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
      throw new BadRequestException({ codigo: 'COORDENADAS_INVALIDAS', mensaje: 'Las coordenadas no son válidas.' });
    }
    return { direccion: await this.direcciones.inversa(la, ln) };
  }
}
