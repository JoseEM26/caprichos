import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { HistorialImpresionService } from './historial-impresion.service';

/** Historial de todo lo impreso (automático, reimpresión, prueba, reintento). Mismo permiso que la cola de impresión. */
@Controller(['admin', 'api/admin'])
@UseGuards(AccesoGuard)
export class HistorialImpresionController {
  constructor(private readonly historial: HistorialImpresionService) {}

  @Get('impresion/historial')
  @Permiso('pedidos', 'ver')
  listar(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('origen') origen?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('equipoId') equipoId?: string,
    @Query('q') q?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    return this.historial.listar({ desde, hasta, origen, tipo, estado, equipoId, q, pagina, limite });
  }

  @Get('pedidos/:id/impresiones')
  @Permiso('pedidos', 'ver')
  deUnPedido(@Param('id') id: string) {
    return this.historial.deUnPedido(id);
  }
}
