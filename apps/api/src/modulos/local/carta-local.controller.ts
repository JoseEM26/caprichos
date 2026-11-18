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

  private cacheProgramar: { valor: unknown; hasta: number } | null = null;

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
    // Caché de 30 s en memoria (endpoint público): evita repetir las consultas de horario por cada visita.
    // ponytail: por instancia; un cambio de horario o del parámetro tarda hasta 30 s en verse.
    if (this.cacheProgramar && this.cacheProgramar.hasta > Date.now()) return this.cacheProgramar.valor;
    const { fueraHorario } = await leerConfigProgramados(this.prisma);
    const valor = fueraHorario ? { habilitado: true, ...(await this.localService.horasProgramables()) } : { habilitado: false, diasMax: 0, dias: [] };
    this.cacheProgramar = { valor, hasta: Date.now() + 30_000 };
    return valor;
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
