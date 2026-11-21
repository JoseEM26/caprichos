import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { SalonVivoService } from './salon-vivo.service';

@Controller('admin/salon/en-vivo')
@UseGuards(AccesoGuard)
export class SalonVivoController {
  constructor(private readonly vivo: SalonVivoService) {}

  /** GET /admin/salon/en-vivo (salon_vivo/ver): plano y estado real del salón, solo lectura y sin datos personales. */
  @Get()
  @Permiso('salon_vivo', 'ver')
  obtener() {
    return this.vivo.obtener();
  }
}
