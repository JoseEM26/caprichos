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

@Controller('admin/creditos')
@UseGuards(AccesoGuard)
export class CreditosController {
  constructor(private readonly creditosService: CreditosService) {}

  @Get('resumen')
  @Permiso('creditos', 'ver')
  async obtenerResumen(@Query() filtros: FiltrarCreditosDto) {
    return this.creditosService.obtenerResumen(filtros);
  }

  @Get('personal-activo')
  @Permiso('creditos', 'ver')
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
