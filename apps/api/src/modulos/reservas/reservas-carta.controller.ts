import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReservasCartaService } from './reservas-carta.service';
import { CrearSolicitudWebDto } from './dto/crear-solicitud-web.dto';

/**
 * Endpoints públicos de la carta para pedir reserva (sin sesión).
 * El cuerpo llega sin tipo de clase a propósito: así el ValidationPipe global no responde
 * sin código, y los errores salen como { codigo: 'VALIDACION', mensaje } en español.
 */
@Controller('carta/reservas')
export class ReservasCartaController {
  constructor(private readonly reservasCarta: ReservasCartaService) {}

  @Get('opciones')
  opciones() {
    return this.reservasCarta.opciones();
  }

  @Post()
  async crear(@Body() cuerpo: Record<string, unknown>, @Req() req: Request) {
    const dto = plainToInstance(CrearSolicitudWebDto, cuerpo && typeof cuerpo === 'object' ? cuerpo : {});
    const errores = await validate(dto);
    if (errores.length > 0) {
      const primero = errores.flatMap((e) => Object.values(e.constraints ?? {}))[0];
      throw new BadRequestException({ codigo: 'VALIDACION', mensaje: primero ?? 'Revisa los datos de la reserva.' });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.reservasCarta.crear(dto, ip);
  }
}
