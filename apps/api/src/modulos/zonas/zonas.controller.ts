import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ZonasService } from './zonas.service';
import { ConsultarEnvioDto } from './dto/consultar-envio.dto';
import { EditarTarifaDto } from './dto/editar-tarifa.dto';
import { EditarActivaDto } from './dto/editar-activa.dto';
import { EditarPoligonoDto } from './dto/editar-poligono.dto';
import { EditarTiempoDto } from './dto/editar-tiempo.dto';

// ===========================================================================
// PÚBLICO (GET /carta/envio)
// ===========================================================================
@Controller('carta/envio')
export class CartaEnvioController {
  constructor(private readonly zonasService: ZonasService) {}

  @Get()
  async consultarEnvio(@Query() query: ConsultarEnvioDto) {
    return this.zonasService.consultarEnvio(Number(query.lat), Number(query.lng));
  }
}

// ===========================================================================
// ADMINISTRATIVO (/admin/zonas con AccesoGuard + @Permiso)
// ===========================================================================
@Controller('admin/zonas')
@UseGuards(AccesoGuard)
export class ZonasAdminController {
  constructor(private readonly zonasService: ZonasService) {}

  @Get()
  @Permiso('zonas', 'ver')
  async listarZonas() {
    return this.zonasService.listarZonasAdmin();
  }

  @Get('diagnostico')
  @Permiso('zonas', 'ver')
  async diagnostico() {
    return this.zonasService.diagnosticoCobertura();
  }

  @Get(':codigo/historial')
  @Permiso('zonas', 'ver')
  async historial(@Param('codigo') codigo: string) {
    return this.zonasService.historialZona(codigo);
  }

  @Put(':codigo/tarifa')
  @Permiso('zonas', 'editar')
  async editarTarifa(
    @Param('codigo') codigo: string,
    @Body() dto: EditarTarifaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.zonasService.editarTarifa(codigo, dto, req.usuario, ip);
  }

  @Put(':codigo/tiempo')
  @Permiso('zonas', 'editar')
  async editarTiempo(
    @Param('codigo') codigo: string,
    @Body() dto: EditarTiempoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.zonasService.editarTiempo(codigo, dto, req.usuario, ip);
  }

  @Put(':codigo/activa')
  @Permiso('zonas', 'editar')
  async editarActiva(
    @Param('codigo') codigo: string,
    @Body() dto: EditarActivaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.zonasService.editarActiva(codigo, dto, req.usuario, ip);
  }

  @Put(':codigo/poligono')
  @Permiso('zonas', 'editar')
  async editarPoligono(
    @Param('codigo') codigo: string,
    @Body() dto: EditarPoligonoDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.zonasService.editarPoligono(codigo, dto, req.usuario, ip);
  }
}
