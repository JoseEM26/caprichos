import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { ClientesAnalisisService } from './clientes.service';

/** Análisis › Clientes. Solo ADMIN y SUPERVISOR (permiso analisis/ver). Todo agregado: sin nombres ni celulares. */
@Controller('admin/analisis/clientes')
@UseGuards(AccesoGuard)
export class ClientesAnalisisController {
  constructor(private readonly clientes: ClientesAnalisisService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string; turno?: string }) {
    return this.clientes.resumen(q);
  }
}
