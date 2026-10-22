import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { ValidarCuponDto } from './dto/validar-cupon.dto';

@Controller('carta')
export class OfertasPublicoController {
  constructor(private readonly ofertasService: OfertasService) {}

  @Get('ofertas')
  async listarOfertasCarta() {
    return this.ofertasService.listarOfertas(undefined, true, 'CARTA');
  }

  @Post('cupon/validar')
  async validarCupon(@Body() dto: ValidarCuponDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ofertasService.validarCuponParaCarta(dto, ip);
  }
}
