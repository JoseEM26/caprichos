import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CANALES_MEDIO_PAGO, mediosPagoActivosCanal } from '@caprichos/compartido';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { leerMediosPagoCanal } from '../../comun/medios-pago-canal';

/**
 * Lectura para pantallas del personal (Caja, mozo, Configuración): cualquier usuario con sesión.
 * El cambio se hace con PUT /admin/configuracion/medios_pago_canal (solo ADMIN, auditado).
 */
@Controller('admin/medios-pago')
@UseGuards(AccesoGuard)
export class MediosPagoController {
  constructor(private readonly prisma: PrismaService) {}

  /** Tabla completa medio × canal. */
  @Get()
  async todo() {
    return { canales: await leerMediosPagoCanal(this.prisma) };
  }

  /** Medios encendidos de un canal (CARTA, CAJA, MOZO o BOT). */
  @Get(':canal')
  async delCanal(@Param('canal') canal: string) {
    const c = canal.toUpperCase();
    return { medios: (CANALES_MEDIO_PAGO as readonly string[]).includes(c) ? mediosPagoActivosCanal(await leerMediosPagoCanal(this.prisma), c) : [] };
  }
}
