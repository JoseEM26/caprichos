import { Controller, Get, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { MARCADORES, leerTextosLegales } from './textos-legales';

/** Vista de Configuración: los textos con lo que falta visible («[Falta: RUC]») y la lista de faltantes. */
@Controller('admin/configuracion/textos-legales')
@UseGuards(AccesoGuard)
export class TextosLegalesAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  async ver() {
    return { ...(await leerTextosLegales(this.prisma, 'admin')), marcadores: MARCADORES };
  }
}
