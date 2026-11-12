import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EscritorioOperativoService } from './escritorio-operativo.service';

@Controller('admin/escritorio')
@UseGuards(AccesoGuard)
export class EscritorioOperativoController {
  constructor(private readonly escritorio: EscritorioOperativoService) {}

  /** Escritorio del personal (todo rol salvo ADMIN): conteos y horarios, sin dinero, solo los bloques que su permiso alcanza. */
  @Get('mio')
  mio(@Req() req: any) {
    return this.escritorio.mio(req.usuario);
  }

  /** Cumpleaños más cercanos del personal activo: solo ADMIN y SUPERVISOR. */
  @Get('cumpleanos')
  @Permiso('escritorio', 'cumpleanos')
  cumpleanos(@Query('dias') dias?: string) {
    return this.escritorio.cumpleanos(dias ? Number(dias) : undefined);
  }

  /** Cumpleaños de clientes (sin edad, celular enmascarado): solo con permiso de ver clientes. */
  @Get('cumpleanos-clientes')
  @Permiso('clientes', 'ver')
  cumpleanosClientes(@Req() req: any, @Query('dias') dias?: string) {
    return this.escritorio.cumpleanosClientes(req.usuario, dias ? Number(dias) : undefined);
  }
}
