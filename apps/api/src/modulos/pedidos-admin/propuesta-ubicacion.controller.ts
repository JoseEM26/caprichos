import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PropuestaUbicacionService } from './propuesta-ubicacion.service';
import { ProponerUbicacionDto } from './dto/proponer-ubicacion.dto';

/** Repartidor: propone la ubicación real del cliente en SUS pedidos en curso y ve el resultado. */
@Controller('admin/repartos')
@UseGuards(AccesoGuard)
export class PropuestaUbicacionController {
  constructor(private readonly propuestas: PropuestaUbicacionService) {}

  @Get(':pedidoId/ubicacion/propuesta')
  @Permiso('repartos', 'ver')
  async vigente(@Param('pedidoId') pedidoId: string, @Req() req: any) {
    return this.propuestas.vigente(pedidoId, req.usuario);
  }

  @Post(':pedidoId/ubicacion/propuesta')
  @Permiso('repartos', 'proponer_ubicacion')
  async proponer(@Param('pedidoId') pedidoId: string, @Body() dto: ProponerUbicacionDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.propuestas.proponer(pedidoId, dto, req.usuario, ip);
  }

  @Post(':pedidoId/ubicacion/propuesta/cancelar')
  @Permiso('repartos', 'proponer_ubicacion')
  async cancelar(@Param('pedidoId') pedidoId: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.propuestas.cancelar(pedidoId, req.usuario, ip);
  }
}
