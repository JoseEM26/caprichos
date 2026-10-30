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

  /** Vista previa de lo que descontará el servidor al crear el pedido (promociones automáticas y cupón) */
  @Post('descuentos/vista-previa')
  async vistaPrevia(
    @Body()
    dto: {
      lineas: { productoId: string; cantidad: number; subtotal: number; precioUnitario: number }[];
      cuponCodigo?: string;
    },
  ) {
    return this.ofertasService.vistaPreviaDescuentos(dto?.lineas ?? [], dto?.cuponCodigo);
  }

  @Post('cupon/validar')
  async validarCupon(@Body() dto: ValidarCuponDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ofertasService.validarCuponParaCarta(dto, ip);
  }
}
