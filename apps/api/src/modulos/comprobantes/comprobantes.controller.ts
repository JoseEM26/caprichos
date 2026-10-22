import {
  Body,
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
import { ComprobantesService } from './comprobantes.service';
import { MarcarEmitidoDto } from './dto/marcar-emitido.dto';
import { ListarPorEmitirDto } from './dto/listar-por-emitir.dto';

@Controller('admin/comprobantes')
@UseGuards(AccesoGuard)
export class ComprobantesController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  /**
   * GET /admin/comprobantes/por-emitir?pagina=&limite=
   * Lista paginada de boletas y facturas con estado POR_EMITIR.
   */
  @Get('por-emitir')
  @Permiso('comprobantes', 'ver')
  async listarPorEmitir(
    @Query() query: ListarPorEmitirDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.listarPorEmitir(query, req.usuario, ip);
  }

  /**
   * GET /admin/comprobantes/pedido/:pedidoId
   * Obtiene los datos completos para la impresión de la nota de venta.
   */
  @Get('pedido/:pedidoId')
  @Permiso('comprobantes', 'ver')
  async obtenerPorPedido(
    @Param('pedidoId') pedidoId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.obtenerPorPedido(pedidoId, req.usuario, ip);
  }

  /**
   * POST /admin/comprobantes/pedido/:pedidoId/reimprimir
   * Reimprime el comprobante marcándolo como «COPIA» y aumentando copias_impresas.
   */
  @Post('pedido/:pedidoId/reimprimir')
  @Permiso('comprobantes', 'reimprimir')
  async reimprimir(
    @Param('pedidoId') pedidoId: string,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.reimprimirPorPedido(pedidoId, req.usuario, ip);
  }

  /**
   * POST /admin/comprobantes/:id/emitido
   * Marca el comprobante como emitido en el facturador externo con su referencia.
   */
  @Post(':id/emitido')
  @Permiso('comprobantes', 'emitir')
  async marcarEmitido(
    @Param('id') id: string,
    @Body() dto: MarcarEmitidoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.comprobantesService.marcarEmitido(id, dto, req.usuario, ip);
  }
}
