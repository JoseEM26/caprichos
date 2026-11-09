import {
  BadRequestException,
  Body,
  ForbiddenException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CierreService } from './cierre.service';
import { ControlCuadreService } from './control-cuadre.service';
import { rolesDelUsuario } from '../acceso/roles-usuario';
import { AjusteMedioDto } from './dto/ajuste-medio.dto';
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';
import { CobrarDto } from '../caja/dto/cobrar.dto';

@Controller('admin/cierre')
@UseGuards(AccesoGuard)
export class CierreController {
  constructor(
    private readonly cierreService: CierreService,
    private readonly controlCuadre: ControlCuadreService,
  ) {}

  /**
   * 1) Arqueo ciego: registra el conteo físico por billetes, monedas y medios digitales.
   * Registro informativo (no cuenta intentos ni bloquea el cierre): entrega { resultado: 'CUADRA'|'NO_CUADRA', intento: n }.
   */
  @Post('arqueo')
  @Permiso('caja', 'cerrar')
  async arqueo(
    @Body() dto: ArqueoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.arqueo(dto, req.usuario, ip);
  }

  /**
   * 2) Cierre: cierra la caja del día creando cierre_caja y cierre_medio.
   * Exige que no haya cobros en curso. Si no cuadra se cierra igual (la nota es opcional).
   */
  @Post('cerrar')
  @Permiso('caja', 'cerrar')
  async cerrar(
    @Body() dto: CerrarCajaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.cerrar(dto, req.usuario, ip);
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
   * Corrige un monto digital con motivo (queda auditado a nombre de quien lo hace).
   */
  @Post('ajustes-medio')
  @Permiso('caja', 'cerrar')
  async registrarAjusteMedio(
    @Body() dto: AjusteMedioDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.registrarAjusteMedio(dto, req.usuario, ip);
  }

  /**
   * Montos esperados por el sistema antes de cerrar, con el desglose del efectivo.
   * Lo ve quien cierra la caja (permiso caja/ver), sin código: el conteo a ciegas ya no se usa.
   */
  @Get('esperado')
  @Permiso('caja', 'ver')
  async obtenerEsperado(@Req() req: any) {
    return this.cierreService.obtenerEsperado(req.usuario);
  }

  /**
   * Control de cuadre del día (solo lectura, ADMIN o SUPERVISOR): cobrado por medio, dinero pagado sin cobro en caja,
   * cobros mal sumados, anulados sin devolver y comprobantes de más. `fecha` = YYYY-MM-DD de Lima.
   */
  @Get('control-cuadre')
  @Permiso('caja', 'ver')
  async controlDeCuadre(@Query('fecha') fecha: string, @Req() req: any) {
    if (!rolesDelUsuario(req.usuario).some((r) => r === 'ADMIN' || r === 'SUPERVISOR')) {
      throw new ForbiddenException({ codigo: 'CONTROL_RESERVADO', mensaje: 'El control de cuadre lo ve el administrador o el supervisor.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) {
      throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'La fecha va como AAAA-MM-DD' });
    }
    return this.controlCuadre.controlar(fecha);
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
   * Pedidos sin cobrar de cualquier día que bloquean el cierre.
   */
  @Get('pendientes')
  @Permiso('caja', 'cerrar')
  async pendientesDeCobro() {
    return this.cierreService.listarPendientesDeCobro();
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

  /** Imprime el ticket de cierre de una caja cerrada en la ticketera de Caja (solo administrador). */
  @Post(':id/imprimir')
  @Permiso('caja', 'ver')
  async imprimir(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.imprimirCierre(id, req.usuario, ip);
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
