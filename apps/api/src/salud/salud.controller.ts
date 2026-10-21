import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SaludService } from './salud.service';

@Controller('salud')
export class SaludController {
  constructor(private readonly saludService: SaludService) {}

  @Get()
  async obtenerSalud(@Res() res: Response) {
    const salud = await this.saludService.verificarSalud();
    const codigo = salud.estado === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(codigo).json(salud);
  }
}
