import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { CajaService } from './caja.service';
import { CobrosService } from './cobros.service';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CobrarDto } from './dto/cobrar.dto';
import { AnularCobroDto } from './dto/anular-cobro.dto';
import { RechazarCobroMozoDto } from './dto/rechazar-cobro-mozo.dto';
import { CrearMovimientoDto } from './dto/movimiento.dto';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto';
import { MarcarCoordinadoDto } from './dto/marcar-coordinado.dto';

@Controller('admin/caja')
@UseGuards(AccesoGuard)
export class CajaController {
  constructor(
    private readonly cajaService: CajaService,
    private readonly cobrosService: CobrosService,
  ) {}

  @Post('abrir')
  @Permiso('caja', 'abrir')
  async abrirCaja(@Body() dto: AbrirCajaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cajaService.abrirCaja(dto, req.usuario, ip);
  }

  @Get('actual')
  @Permiso('caja', 'ver')
  async obtenerCajaActual(@Req() req: any) {
    return this.cajaService.obtenerCajaActual(req.usuario);
  }

  @Post('cobrar')
  @Permiso([
    { modulo: 'caja', accion: 'cobrar' },
    { modulo: 'mesas', accion: 'abrir' },
  ])
  async cobrar(@Body() dto: CobrarDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cobrosService.cobrar(dto, req.usuario, ip);
  }

  @Post('pedidos/:id/rechazar-cobro-mozo')
  @Permiso('caja', 'cobrar')
  async rechazarCobroMozo(@Param('id') id: string, @Body() dto: RechazarCobroMozoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cobrosService.rechazarCobroMozo(id, dto, req.usuario, ip);
  }

  @Post('cobros/:id/anular')
  @Permiso('caja', 'cobrar')
  @RequiereCodigoSupervisor('caja/anular_cobro')
  async anularCobro(
    @Param('id') id: string,
    @Body() dto: AnularCobroDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'] ||
      req.headers?.['X-Pin-Supervisor'];
    return this.cobrosService.anularCobro(
      id,
      dto,
      pin,
      req.usuario,
      ip,
      ...(req.codigoSupervisorVerificado ? [true] : []),
    );
  }

  @Post('movimientos')
  @Permiso('caja', 'movimientos')
  async crearMovimiento(@Body() dto: CrearMovimientoDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cajaService.crearMovimiento(dto, req.usuario, ip);
  }

  @Get('movimientos')
  @Permiso('caja', 'movimientos')
  async listarMovimientos() {
    return this.cajaService.listarMovimientos();
  }

  @Post('movimientos/:id/anular')
  @Permiso('caja', 'movimientos')
  @RequiereCodigoSupervisor('caja/anular_movimiento')
  async anularMovimiento(
    @Param('id') id: string,
    @Body() dto: AnularMovimientoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cajaService.anularMovimiento(id, dto, req.usuario, ip);
  }

  @Get('por-cobrar')
  @Permiso('caja', 'ver')
  async listarPorCobrar(@Req() req: any) {
    return this.cobrosService.listarPorCobrar(req.usuario);
  }

  @Post('pedidos/:id/coordinado')
  @Permiso('caja', 'cobrar')
  async marcarCoordinado(
    @Param('id') id: string,
    @Body() dto: MarcarCoordinadoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cobrosService.marcarCoordinado(id, req.usuario, ip, dto);
  }
}
