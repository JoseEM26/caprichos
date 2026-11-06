import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { CortesiasService } from './cortesias.service';
import { requiereCodigoCortesia } from './cortesia.tipos';
import { DarCortesiaLineaDto, FiltroCortesiasDto, RegistrarCortesiaDto } from './dto/cortesias.dto';

/** Quien presentó el código de supervisor (si el guard lo pidió) queda como autorizador. */
function autorizadorDe(req: any): bigint | undefined {
  const p = req.supervisor?.supervisorPartyId ?? req.supervisor?.party_id;
  return p !== undefined && p !== null ? BigInt(p) : undefined;
}

@Controller('admin/cortesias')
@UseGuards(AccesoGuard)
export class CortesiasController {
  constructor(private readonly cortesias: CortesiasService) {}

  /** Cortesía por separado. Caja y ADMIN directo; el SUPERVISOR presenta su código. */
  @Post()
  @Permiso('cortesias', 'dar')
  @RequiereCodigoSupervisor('cortesias/dar', { condicion: requiereCodigoCortesia, exigeCodigoSupervisor: true })
  async registrar(@Body() dto: RegistrarCortesiaDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cortesias.registrarSeparada(dto, req.usuario, autorizadorDe(req), ip);
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
  @RequiereCodigoSupervisor('cortesias/dar', { condicion: requiereCodigoCortesia, exigeCodigoSupervisor: true })
  async darEnLinea(
    @Param('id') id: string,
    @Param('lineaId') lineaId: string,
    @Body() dto: DarCortesiaLineaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.cortesias.darEnLinea(id, lineaId, dto, req.usuario, autorizadorDe(req), ip);
  }
}
