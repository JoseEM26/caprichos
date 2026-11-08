import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { CortesiasService } from './cortesias.service';
import { DarCortesiaLineaDto, FiltroCortesiasDto, RegistrarCortesiaDto } from './dto/cortesias.dto';

@Controller('admin/cortesias')
@UseGuards(AccesoGuard)
export class CortesiasController {
  constructor(private readonly cortesias: CortesiasService) {}

  /** Cortesía por separado. Quien tenga el permiso cortesias/dar (queda auditada). */
  @Post()
  @Permiso('cortesias', 'dar')
  async registrar(@Body() dto: RegistrarCortesiaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cortesias.registrarSeparada(dto, req.usuario, ip);
  }

  /** Listado y resumen de cortesías (el mismo que el informe «Cortesías»). */
  @Get()
  @Permiso('cortesias', 'ver')
  async listar(@Query() filtro: FiltroCortesiasDto) {
    return this.cortesias.consultar(filtro);
  }
}

@Controller('admin/pedidos')
@UseGuards(AccesoGuard)
export class CortesiaLineaController {
  constructor(private readonly cortesias: CortesiasService) {}

  /** Marca una línea de un pedido todavía no cobrado como cortesía (queda a S/ 0). */
  @Post(':id/lineas/:lineaId/cortesia')
  @Permiso('cortesias', 'dar')
  async darEnLinea(
    @Param('id') id: string,
    @Param('lineaId') lineaId: string,
    @Body() dto: DarCortesiaLineaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cortesias.darEnLinea(id, lineaId, dto, req.usuario, ip);
  }
}
