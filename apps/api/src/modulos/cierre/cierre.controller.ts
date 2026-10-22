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
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';

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
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.arqueo(dto, req.usuario, pinSupervisor, ip);
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
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cierreService.cerrar(dto, req.usuario, pinSupervisor, ip);
  }

  /**
   * Montos esperados por el sistema antes de cerrar.
   * Solo para rol ADMIN.
   */
  @Get('esperado')
  @Permiso('caja', 'ver')
  async obtenerEsperado(@Req() req: any) {
    return this.cierreService.obtenerEsperado(req.usuario);
  }

  /**
   * Historial de cierres de caja con paginación y filtros de fecha.
   */
  @Get('historial')
  @Permiso('caja', 'ver')
  async historial(@Query() query: HistorialCierresDto) {
    return this.cierreService.historial(query);
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
  async obtenerPorId(@Param('id') id: string) {
    return this.cierreService.obtenerCierrePorId(id);
  }
}
