import { Controller, Get, Query, Req } from '@nestjs/common';
import { DireccionesService } from './direcciones.service';
import { BuscarDireccionDto } from './dto/buscar-direccion.dto';

// PÚBLICO: la carta busca la dirección que escribe el cliente
@Controller('carta/direcciones')
export class DireccionesController {
  constructor(private readonly direcciones: DireccionesService) {}

  @Get()
  buscar(@Query() query: BuscarDireccionDto, @Req() req: any) {
    return this.direcciones.buscar(query.q, req.ip);
  }
}
