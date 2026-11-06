import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PropinasService } from './propinas.service';

@Controller('admin/propinas')
@UseGuards(AccesoGuard)
export class PropinasController {
  constructor(private readonly propinas: PropinasService) {}

  /** Acumulado de un mes de Lima (por defecto, el actual). Solo lo cobrado y no anulado ni devuelto. */
  @Get('mes')
  @Permiso('propinas', 'ver')
  async mes(@Query('anio') anio?: string, @Query('mes') mes?: string) {
    const actual = this.propinas.mesActualLima();
    return this.propinas.resumenMes(anio ? Number(anio) : actual.anio, mes ? Number(mes) : actual.mes);
  }

  /** Aviso: pedidos entregados con propina sin cobro en caja (la propina aún no cuenta). */
  @Get('pendientes')
  @Permiso('propinas', 'ver')
  async pendientes() {
    return this.propinas.pendientesDeCobro();
  }

  @Get('configuracion')
  @Permiso('propinas', 'ver')
  async configuracion() {
    return this.propinas.configuracion();
  }
}
