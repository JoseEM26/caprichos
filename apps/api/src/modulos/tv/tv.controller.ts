import { Body, Controller, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { ComandasService } from '../cocina/comandas.service';
import { ComandasQueryDto } from '../cocina/dto/comandas-query.dto';
import { SalonVivoService } from '../salon/salon-vivo.service';
import { TvGuard } from './tv.guard';
import { limitarTv, llaveDe } from './tv.limite';
import { TvService } from './tv.service';

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
  salonVivo() {
    return this.vivo.obtener();
  }

  @Get('cocina/areas')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  areas() {
    return this.comandas.listarAreas();
  }

  /** Comandas del área fijada al vincular; si la TV no tiene área, la que pida (o todas). */
  @Get('cocina/comandas')
  @UseGuards(TvGuard)
  @Header('Cache-Control', 'no-store')
  listarComandas(@Query() q: ComandasQueryDto, @Req() req: any) {
    const fija = req.tv?.area_id ? String(req.tv.area_id) : undefined;
    return this.comandas.listarComandas(fija ?? q.area);
  }
}
