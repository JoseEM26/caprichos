import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CreditosService } from './creditos.service';
import { FiltrarCreditosDto } from './dto/filtrar-creditos.dto';
import { RegistrarConsumoDto } from './dto/registrar-consumo.dto';
import { MarcarCobradoDto, MarcarPlanillaDto, SaldarConsumosDto } from './dto/saldar-consumos.dto';

@Controller('admin/creditos')
@UseGuards(AccesoGuard)
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Get('resumen')
  @Permiso('creditos', 'ver')
  async obtenerResumen(@Query() filtros: FiltrarCreditosDto) {
    return this.creditosService.obtenerResumen(filtros);
  }

  // Candidatos de «Pedido del personal» (solo partyId, nombre, rol, descuentoPct): lo necesita todo rol que crea pedidos
  @Get('personal-activo')
  @Permiso([{ modulo: 'creditos', accion: 'ver' }, { modulo: 'pedidos', accion: 'crear' }])
  async listarPersonalActivo() {
    return this.creditosService.listarPersonalActivo();
  }

  @Get('exportar')
  @Permiso('creditos', 'exportar')
  async exportar(
    @Query() filtros: FiltrarCreditosDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'];
    const { nombreArchivo, contenidoCsv } = await this.creditosService.exportar(
      filtros,
      req.usuario,
      ip,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(contenidoCsv);
  }

  @Get('cuenta')
  @Permiso('creditos', 'ver')
  async cuenta(@Query('partyId') partyId: string) {
    return this.creditosService.obtenerCuenta(partyId);
  }

  @Post('saldar')
  @Permiso('creditos', 'saldar')
  async saldar(@Body() dto: SaldarConsumosDto, @Req() req: any) {
    return this.creditosService.saldar(dto, req.usuario, req.ip || req.headers?.['x-forwarded-for']);
  }

  @Post('marcar-cobrado')
  @Permiso('creditos', 'saldar')
  async marcarCobrado(@Body() dto: MarcarCobradoDto, @Req() req: any) {
    return this.creditosService.marcarCobrado(dto, req.usuario, req.ip || req.headers?.['x-forwarded-for']);
  }

  @Post('planilla')
  @Permiso('creditos', 'saldar')
  async planilla(@Body() dto: MarcarPlanillaDto, @Req() req: any) {
    return this.creditosService.marcarPeriodoPlanilla(dto, req.usuario, req.ip || req.headers?.['x-forwarded-for']);
  }

  @Post('consumo')
  @Permiso('creditos', 'ver')
  async registrarConsumo(
    @Body() dto: RegistrarConsumoDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers?.['x-forwarded-for'];
    return this.creditosService.registrarConsumo(
      dto.pedidoId,
      dto.partyId,
      req.usuario,
      ip,
    );
  }
}
