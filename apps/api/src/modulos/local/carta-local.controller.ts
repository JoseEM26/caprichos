import { Controller, Get } from '@nestjs/common';
import { LocalService } from './local.service';

/**
 * Endpoints públicos de la carta virtual (sin guard de autenticación).
 */
@Controller('carta')
export class CartaLocalController {
  constructor(private readonly localService: LocalService) {}

  @Get('estado')
  async obtenerEstado() {
    return this.localService.obtenerEstadoCarta();
  }

  @Get('local')
  async obtenerDatosLocal() {
    return this.localService.obtenerDatosPublicosLocal();
  }
}
