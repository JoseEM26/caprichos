import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { OfertasService } from './ofertas.service';
import { ValidarCuponDto } from './dto/validar-cupon.dto';
import { ClientesService } from '../clientes/clientes.service';

@Controller('carta')
export class OfertasPublicoController {
  constructor(
    private readonly ofertasService: OfertasService,
    private readonly clientesService: ClientesService,
  ) {}

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
    @Req() req: any,
  ) {
    // Con sesión iniciada en la carta, la vista previa incluye la primera compra igual que al crear el pedido
    const cliente = await this.clientesService.clienteDesdeRequest(req).catch(() => null);
    return this.ofertasService.vistaPreviaDescuentos(dto?.lineas ?? [], dto?.cuponCodigo, cliente?.partyId ?? null);
  }

  @Post('cupon/validar')
  async validarCupon(@Body() dto: ValidarCuponDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ofertasService.validarCuponParaCarta(dto, ip);
  }
}
