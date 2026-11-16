import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { PagosAnalisisService } from './pagos.service';

/** Análisis › Medios de pago. Como Ventas: el dinero solo sale para ADMIN; el SUPERVISOR ve conteos. */
@Controller('admin/analisis/pagos')
@UseGuards(AccesoGuard)
export class PagosAnalisisController {
  constructor(private readonly pagos: PagosAnalisisService) {}

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string; modalidad?: string; canal?: string }, @Req() req: { usuario?: { rol?: string; roles?: string[] } }) {
    const u = req.usuario;
    const esAdmin = !!u && (u.roles ?? [u.rol]).includes('ADMIN');
    return this.pagos.resumen(q, esAdmin);
  }
}
