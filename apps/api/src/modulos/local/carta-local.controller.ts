import { Controller, Get, Header } from '@nestjs/common';
import { mediosPagoActivosCanal } from '@caprichos/compartido';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { leerMediosPagoCanal } from '../../comun/medios-pago-canal';
import { leerConfigProgramados } from '../pedidos/programado.util';
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

  /**
   * Con el local cerrado: ¿el cliente puede programar su pedido (llevar o delivery) y para cuándo?
   * Apagado (parámetro «no») responde habilitado:false y sin días: la carta queda como siempre.
   */
  @Get('programar-horas')
  @Header('Cache-Control', 'no-store')
  async programarHoras() {
    const { fueraHorario } = await leerConfigProgramados(this.prisma);
    if (!fueraHorario) return { habilitado: false, diasMax: 0, dias: [] };
    return { habilitado: true, ...(await this.localService.horasProgramables()) };
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
