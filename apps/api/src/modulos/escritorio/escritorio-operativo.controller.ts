import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { EscritorioOperativoService } from './escritorio-operativo.service';

@Controller('admin/escritorio')
@UseGuards(AccesoGuard)
export class EscritorioOperativoController {
  constructor(private readonly escritorio: EscritorioOperativoService) {}

  /** Escritorio del SUPERVISOR: conteos y horarios, sin dinero. */
  @Get('operativo')
  @Permiso('escritorio', 'operativo')
  obtener() {
    return this.escritorio.obtener();
  }
}
