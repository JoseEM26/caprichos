import { Controller, Get, Header } from '@nestjs/common';
import { mediosPagoActivosCanal } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { leerMediosPagoCanal } from '../../comun/medios-pago-canal';
import { LocalService } from './local.service';

/**
 * Endpoints públicos de la carta virtual (sin guard de autenticación).
 */
@Controller('carta')
export class CartaLocalController {
  constructor(
    private readonly localService: LocalService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('estado')
  @Header('Cache-Control', 'no-store')
  async obtenerEstado() {
    return this.localService.obtenerEstadoCartaSeguro();
  }

  @Get('local')
  async obtenerDatosLocal() {
    return this.localService.obtenerDatosPublicosLocal();
  }

  /** Medios de pago encendidos en la carta virtual (solo lectura, público). */
  @Get('medios-pago')
  @Header('Cache-Control', 'no-store')
  async mediosPago() {
    return { medios: mediosPagoActivosCanal(await leerMediosPagoCanal(this.prisma), 'CARTA') };
  }
}
