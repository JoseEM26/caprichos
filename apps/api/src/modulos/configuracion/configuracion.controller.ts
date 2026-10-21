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
import { ConfiguracionService } from './configuracion.service';
import { ActualizarParametroDto } from './dto/actualizar-parametro.dto';

@Controller('admin/configuracion')
@UseGuards(AccesoGuard)
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Get()
  @Permiso('configuracion', 'ver')
  async listar() {
    return this.configuracionService.listar();
  }

  @Put(':clave')
  @Permiso('configuracion', 'editar')
  async actualizar(
    @Param('clave') clave: string,
    @Body() dto: ActualizarParametroDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.configuracionService.actualizar(clave, dto.valor, req.usuario, ip);
  }
}
