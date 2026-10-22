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
import { RecetasService } from './recetas.service';
import { GuardarRecetaDto } from './dto/guardar-receta.dto';
import { AjusteOpcionDto } from './dto/ajuste-opcion.dto';

@Controller('admin/recetas')
@UseGuards(AccesoGuard)
export class RecetasController {
  constructor(private readonly recetasService: RecetasService) {}

  @Get()
  @Permiso('recetas', 'ver')
  async listarProductos() {
    return this.recetasService.listarProductosConMargen();
  }

  @Get('opciones/:opcionId')
  @Permiso('recetas', 'ver')
  async obtenerAjusteOpcion(@Param('opcionId') opcionId: string) {
    return this.recetasService.obtenerAjusteOpcion(opcionId);
  }

  @Put('opciones/:opcionId')
  @Permiso('recetas', 'editar')
  async guardarAjusteOpcion(
    @Param('opcionId') opcionId: string,
    @Body() dto: AjusteOpcionDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.recetasService.guardarAjusteOpcion(opcionId, dto, req.usuario, ip);
  }

  @Get(':productoId')
  @Permiso('recetas', 'ver')
  async obtenerReceta(@Param('productoId') productoId: string) {
    return this.recetasService.obtenerRecetaProducto(productoId);
  }

  @Put(':productoId')
  @Permiso('recetas', 'editar')
  async guardarReceta(
    @Param('productoId') productoId: string,
    @Body() dto: GuardarRecetaDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.recetasService.guardarReceta(productoId, dto, req.usuario, ip);
  }
}
