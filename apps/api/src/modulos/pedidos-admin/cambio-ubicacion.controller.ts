import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CambioUbicacionService } from './cambio-ubicacion.service';
import { PropuestaUbicacionService } from './propuesta-ubicacion.service';
import { UbicarPedidoDto } from './dto/ubicar-pedido.dto';
import { LiquidarAjusteUbicacionDto } from './dto/liquidar-ajuste-ubicacion.dto';
import { RechazarPropuestaUbicacionDto } from './dto/rechazar-propuesta-ubicacion.dto';

/** Número de la query (lat/lng) dentro de rango, o 400. */
function coordenada(valor: unknown, min: number, max: number, nombre: string): number {
  const n = typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new BadRequestException({ codigo: 'COORDENADA_INVALIDA', mensaje: `La ${nombre} no es válida` });
  }
  return n;
}

/** Cambio de ubicación de un delivery desde Caja (cambio directo, vista previa, propuestas y ajustes de cobro). */
@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class CambioUbicacionController {
  constructor(
    private readonly cambio: CambioUbicacionService,
    private readonly propuestas: PropuestaUbicacionService,
  ) {}

  @Get(':id/ubicacion/previsualizar')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async previsualizar(@Param('id') id: string, @Query('lat') lat: string, @Query('lng') lng: string) {
    return this.cambio.previsualizar(
      id,
      coordenada(lat, -90, 90, 'latitud'),
      coordenada(lng, -180, 180, 'longitud'),
    );
  }

  @Post(':id/ubicacion/cambiar')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async cambiar(@Param('id') id: string, @Body() dto: UbicarPedidoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cambio.cambiarPorCaja(id, dto, req.usuario, ip);
  }

  @Get(':id/ubicacion/historial')
  @Permiso('pedidos', 'ver')
  async historial(@Param('id') id: string) {
    return this.cambio.historial(id);
  }

  @Post(':id/ubicacion/ajustes/:cambioId/liquidar')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async liquidar(
    @Param('id') id: string,
    @Param('cambioId') cambioId: string,
    @Body() dto: LiquidarAjusteUbicacionDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cambio.liquidarAjuste(id, cambioId, dto, req.usuario, ip);
  }

  /** Propuestas del repartidor pendientes (bandeja de Caja). */
  @Get('ubicacion/propuestas')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async pendientes() {
    return this.propuestas.pendientes();
  }

  @Post(':id/ubicacion/propuestas/:propuestaId/aprobar')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async aprobar(@Param('id') id: string, @Param('propuestaId') propuestaId: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.propuestas.aprobar(id, propuestaId, req.usuario, ip);
  }

  @Post(':id/ubicacion/propuestas/:propuestaId/rechazar')
  @Permiso('pedidos', 'cambiar_ubicacion')
  async rechazar(
    @Param('id') id: string,
    @Param('propuestaId') propuestaId: string,
    @Body() dto: RechazarPropuestaUbicacionDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.propuestas.rechazar(id, propuestaId, dto, req.usuario, ip);
  }
}
