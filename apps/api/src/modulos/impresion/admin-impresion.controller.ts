import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ImpresionService } from './impresion.service';
import {
  CrearLlaveDto,
  ReimprimirDto,
} from './dto';

@Controller(['admin/impresion', 'api/admin/impresion'])
@UseGuards(AccesoGuard)
export class AdminImpresionController {
  constructor(private readonly impresionService: ImpresionService) {}

  @Get('estado')
  @Permiso('pedidos', 'ver')
  async obtenerEstado() {
    return this.impresionService.obtenerEstadoAdmin();
  }

  @Get('trabajos')
  @Permiso('pedidos', 'ver')
  async listarTrabajos(
    @Query('estado') estado?: string,
    @Query('pedido') pedido?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
  ) {
    const pag = pagina ? parseInt(pagina, 10) : 1;
    const lim = limite ? parseInt(limite, 10) : 20;
    return this.impresionService.listarTrabajos(estado, pedido, pag, lim);
  }

  @Post('trabajos/:id/reintentar')
  @Permiso('pedidos', 'cambiar_estado')
  async reintentarTrabajo(@Param('id') id: string) {
    return this.impresionService.reintentarTrabajo(id);
  }

  @Post('pedidos/:id/reimprimir')
  @Permiso('pedidos', 'cambiar_estado')
  async reimprimir(
    @Param('id') id: string,
    @Body() dto: ReimprimirDto,
  ) {
    return this.impresionService.reimprimirEtiqueta(id, dto);
  }

  @Get('llaves')
  @Permiso('usuarios', 'ver')
  async listarLlaves(@Req() req: any) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    return this.impresionService.listarLlavesAgente();
  }

  @Post('llaves')
  @Permiso('usuarios', 'crear')
  async crearLlave(
    @Body() dto: CrearLlaveDto,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.crearLlaveAgente(dto, req.usuario, ip);
  }

  @Patch('llaves/:id/desactivar')
  @Permiso('usuarios', 'desactivar')
  async desactivarLlave(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.desactivarLlaveAgente(id, req.usuario, ip);
  }

  @Post('llaves/:id/desactivar')
  @Permiso('usuarios', 'desactivar')
  async desactivarLlavePost(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    if (req.usuario?.rol !== 'ADMIN') {
      throw new ForbiddenException({
        codigo: 'SOLO_ADMIN',
        mensaje: 'Solo los administradores pueden gestionar llaves de agentes',
      });
    }
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.impresionService.desactivarLlaveAgente(id, req.usuario, ip);
  }
}
