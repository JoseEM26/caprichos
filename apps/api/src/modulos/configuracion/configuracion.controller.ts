import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { RequiereCodigoSupervisor } from '../supervisor-codigo/requiere-codigo-supervisor.decorator';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarParametroDto } from './dto/actualizar-parametro.dto';
import { PausaAltaDemandaDto } from './dto/pausa-alta-demanda.dto';

@Controller('admin/configuracion')
@UseGuards(AccesoGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  async listar() {
    return this.configuracionService.listar();
  }

  @Put('pausa-alta-demanda')
  @Permiso('configuracion', 'editar')
  @RequiereCodigoSupervisor('configuracion/pausa_alta_demanda')
  async actualizarPausaAltaDemanda(
    @Body() dto: PausaAltaDemandaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizarPausaAltaDemanda(dto, req.usuario, ip);
  }

  @Put(':clave')
  @Permiso('configuracion', 'editar')
  @RequiereCodigoSupervisor('configuracion/editar_parametro_sensible', {
    condicion: (req) =>
      ['permisos_roles', 'permisos', 'roles', 'tiempos_alerta'].includes(req.params?.clave),
  })
  async actualizar(
    @Param('clave') clave: string,
    @Body() dto: ActualizarParametroDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizar(clave, dto.valor, req.usuario, ip);
  }
}
