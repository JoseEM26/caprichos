import { Controller, Get, Header } from '@nestjs/common';
import { LocalService } from './local.service';

/**
 * Endpoints públicos de la carta virtual (sin guard de autenticación).
 */
@Controller('carta')
export class CartaLocalController {
  constructor(private readonly localService: LocalService) {}

  @Get('estado')
  @Header('Cache-Control', 'no-store')
  async obtenerEstado() {
    return this.localService.obtenerEstadoCartaSeguro();
  }

  @Get('local')
  async obtenerDatosLocal() {
    return this.localService.obtenerDatosPublicosLocal();
  }
}
