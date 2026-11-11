import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
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
  async listarOfertasCarta(@Query('modalidad') modalidad?: string) {
    // Sin modalidad (el cliente aún no elige) salen todas con su lista de modalidades para etiquetarlas
    return this.ofertasService.listarOfertas(undefined, false, 'CARTA', true, modalidad);
  }

  /** Vista previa de lo que descontará el servidor al crear el pedido (promociones automáticas y cupón) */
  @Post('descuentos/vista-previa')
  async vistaPrevia(
    @Body()
    dto: {
      lineas: { productoId: string; cantidad: number; subtotal: number; precioUnitario: number }[];
      cuponCodigo?: string;
      modalidad?: string;
      celular?: string;
    },
    @Req() req: any,
  ) {
    // Con sesión iniciada en la carta, la vista previa incluye la primera compra igual que al crear el pedido
    const cliente = await this.clientesService.clienteDesdeRequest(req).catch(() => null);
    // Celular escrito en el pedido (9 dígitos): da el descuento del equipo si es de un trabajador activo; la respuesta no dice de quién
    const celular = typeof dto?.celular === 'string' && /^9\d{8}$/.test(dto.celular.trim()) ? dto.celular.trim() : undefined;
    if (celular) await this.ofertasService.limitarConsultaCelular(celular, req?.ip);
    return this.ofertasService.vistaPreviaDescuentos(dto?.lineas ?? [], dto?.cuponCodigo, cliente?.partyId ?? null, 'CARTA', dto?.modalidad, undefined, celular);
  }

  @Post('cupon/validar')
  async validarCupon(@Body() dto: ValidarCuponDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.ofertasService.validarCuponParaCarta(dto, ip);
  }
}
