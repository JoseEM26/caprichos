import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CierreService } from './cierre.service';
import { AjusteMedioDto } from './dto/ajuste-medio.dto';
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';
import { CobrarDto } from '../caja/dto/cobrar.dto';

@Controller('admin/cierre')
@UseGuards(AccesoGuard)
export class CierreController {
  constructor(private readonly cierreService: CierreService) {}

  /**
   * 1) Arqueo ciego: registra el conteo físico por billetes, monedas y medios digitales.
   * La respuesta es ciega: únicamente entrega { resultado: 'CUADRA'|'NO_CUADRA', intento: n }.
   */
  @Post('arqueo')
  @Permiso('caja', 'cerrar')
  async arqueo(
    @Body() dto: ArqueoDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.cierreService.arqueo(dto, req.usuario, pin, ip);
  }

  /**
   * 2) Cierre: cierra la caja del día creando cierre_caja y cierre_medio.
   * Exige que no haya cobros en curso. Si no cuadra, exige PIN de supervisor y nota.
   */
  @Post('cerrar')
  @Permiso('caja', 'cerrar')
  async cerrar(
    @Body() dto: CerrarCajaDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.cierreService.cerrar(dto, req.usuario, pin, ip);
  }

  /**
   * Montos digitales de la caja abierta (Yape, Plin, transferencia, tarjeta), ya calculados por el sistema.
   * Sin efectivo, esperado ni diferencias: el cierre ciego del efectivo se mantiene.
   */
  @Get('digitales')
  @Permiso('caja', 'cerrar')
  async obtenerDigitales() {
    return this.cierreService.obtenerDigitales();
  }

  /** Devoluciones de pedidos de la caja abierta (informativo, para reconciliar Yape/Plin devueltos). */
  @Get('devoluciones')
  @Permiso('caja', 'cerrar')
  async listarDevolucionesTurno() {
    return this.cierreService.listarDevolucionesTurno();
  }

  /** Correcciones de montos digitales de la caja abierta. */
  @Get('ajustes-medio')
  @Permiso('caja', 'cerrar')
  async listarAjustesMedio() {
    return this.cierreService.listarAjustesMedio();
  }

  /**
   * Corrige un monto digital con motivo. ADMIN y SUPERVISOR sin código; el cajero con código de supervisor.
   */
  @Post('ajustes-medio')
  @Permiso('caja', 'cerrar')
  async registrarAjusteMedio(
    @Body() dto: AjusteMedioDto,
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.cierreService.registrarAjusteMedio(dto, req.usuario, pin, ip);
  }

  /**
   * Montos esperados por el sistema antes de cerrar.
   * Administrador directo; otro rol solo con el PIN de la supervisora (cabecera x-pin-supervisor o x-codigo-supervisor).
   */
  @Get('esperado')
  @Permiso('caja', 'ver')
  async obtenerEsperado(
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.cierreService.obtenerEsperado(req.usuario, pin, ip);
  }

  /**
   * Historial de cierres de caja con paginación y filtros de fecha.
   */
  @Get('historial')
  @Permiso('caja', 'ver')
  async historial(@Query() query: HistorialCierresDto, @Req() req: any) {
    return this.cierreService.historial(query, req.usuario);
  }

  /**
   * 3) Liquidación de repartidores: lista repartidores con pedidos delivery entregados
   * cobrados en efectivo contra entrega y el monto pendiente de entrega.
   */
  @Get('repartidores')
  @Permiso('repartos', 'liquidar')
  async listarRepartidores() {
    return this.cierreService.listarRepartidoresPorLiquidar();
  }

  /**
   * Pedidos sin cobrar de cualquier día que bloquean el cierre. Admin o PIN de supervisor.
   */
  @Get('pendientes')
  @Permiso('caja', 'cerrar')
  async pendientesDeCobro(
    @Headers('x-pin-supervisor') pinSupervisor: string | undefined,
    @Req() req: any,
    @Headers('x-codigo-supervisor') codigoSupervisor?: string,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const pin =
      codigoSupervisor ||
      pinSupervisor ||
      req.headers?.['x-codigo-supervisor'] ||
      req.headers?.['x-pin-supervisor'];
    return this.cierreService.listarPendientesDeCobro(req.usuario, pin, ip);
  }

  /**
   * Cobra un pedido pendiente en la caja que se cierra (Cobrar ahora desde el cierre).
   */
  @Post('pendientes/:id/cobrar')
  @Permiso('caja', 'cobrar')
  async cobrarPendiente(
    @Param('id') id: string,
    @Body() dto: CobrarDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.cobrarPendienteDeCierre(id, dto, req.usuario, ip);
  }

  /**
   * Registra la entrega de efectivo de un repartidor (esperado, entregado, diferencia).
   */
  @Post('liquidar')
  @Permiso('repartos', 'liquidar')
  async liquidar(
    @Body() dto: LiquidarRepartidorDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.liquidarRepartidor(dto, req.usuario, ip);
  }

  /**
   * Consulta el detalle de un cierre por ID (mostrando diferencias por medio).
   */
  @Get(':id')
  @Permiso('caja', 'ver')
  async obtenerPorId(@Param('id') id: string, @Req() req: any) {
    return this.cierreService.obtenerCierrePorId(id, req.usuario);
  }
}
