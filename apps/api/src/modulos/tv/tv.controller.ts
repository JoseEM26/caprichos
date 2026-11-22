import { Body, Controller, ForbiddenException, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ComandasService } from '../cocina/comandas.service';
import { ComandasQueryDto } from '../cocina/dto/comandas-query.dto';
import { PantallaLocalService } from '../pantalla-local/pantalla-local.service';
import { SalonVivoService } from '../salon/salon-vivo.service';
import { TvGuard } from './tv.guard';
import { limitarTv, llaveDe } from './tv.limite';
import { TvService } from './tv.service';

/** Cada TV solo lee la vista con la que se vinculó (salón no ve comandas y cocina no ve el salón). */
function exigirVista(req: any, vista: string, estricta = false) {
  if ((estricta || req.tv?.vista) && req.tv?.vista !== vista) throw new ForbiddenException({ codigo: 'VISTA_NO_PERMITIDA', mensaje: 'Esta pantalla no está vinculada para esta vista' });
}

class PedirCodigoTvDto {
  @IsString()
  vista!: string;
}

/**
 * TV del local sin sesión. Va bajo /carta/tv para que el proxy lo mande a la API (/tv/* es una ruta de la web).
 * Códigos y llaves no se registran. Solo lectura, con la llave que recibió la TV al pedir su código.
 */
@Controller('carta/tv')
export class TvController {
  constructor(
    private readonly tv: TvService,
    private readonly vivo: SalonVivoService,
    private readonly comandas: ComandasService,
    private readonly pantallaLocal: PantallaLocalService,
  ) {}

  @Post('codigo')
  @Header('Cache-Control', 'no-store')
  codigo(@Body() dto: PedirCodigoTvDto, @Req() req: any) {
    limitarTv('codigo', req, 20);
    return this.tv.crearCodigo(dto.vista);
  }

  @Get('estado')
  @Header('Cache-Control', 'no-store')
  estado(@Req() req: any) {
    limitarTv('estado', req, 120);
    return this.tv.estado(llaveDe(req));
  }

  @Get('salon-vivo')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  salonVivo(@Req() req: any) {
    exigirVista(req, 'SALON_VIVO');
    return this.vivo.obtener();
  }

  /** Pedidos del local para la TV vinculada como «Pedidos del local»: nombre de pila, productos y pago; nunca celular, DNI ni dirección. */
  @Get('pedidos-local')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  pedidosLocal(@Req() req: any) {
    exigirVista(req, 'PANTALLA_LOCAL', true); // datos personales: una TV sin vista (antigua) tampoco entra
    return this.pantallaLocal.pedidos();
  }

  @Get('cocina/areas')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  areas(@Req() req: any) {
    exigirVista(req, 'COCINA');
    return this.comandas.listarAreas();
  }

  /** Comandas del área fijada al vincular; si la TV no tiene área, la que pida (o todas). */
  @Get('cocina/comandas')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  listarComandas(@Query() q: ComandasQueryDto, @Req() req: any) {
    exigirVista(req, 'COCINA');
    const fija = req.tv?.area_id ? String(req.tv.area_id) : undefined;
    return this.comandas.listarComandas(fija ?? q.area);
  }
}
