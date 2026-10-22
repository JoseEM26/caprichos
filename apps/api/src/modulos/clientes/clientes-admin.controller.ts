import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ClientesService } from './clientes.service';
import { PuntosService } from './puntos.service';
import {
  AjustarPuntosDto,
  EditarClienteAdminDto,
  RegistrarMostradorDto,
} from './clientes.tipos';

@Controller('admin/clientes')
@UseGuards(AccesoGuard)
export class ClientesAdminController {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly puntosService: PuntosService,
  ) {}

  @Get()
  @Permiso('clientes', 'ver')
  async listar(
    @Query('q') q?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('creditoPersonal') creditoPersonal?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Req() req?: any,
  ) {
    const ip = (req?.ip || req?.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.listarAdmin(
      {
        q,
        tipo,
        estado,
        creditoPersonal,
        pagina: pagina ? parseInt(pagina, 10) : 1,
        limite: limite ? parseInt(limite, 10) : 6,
      },
      req?.usuario,
      ip,
    );
  }

  @Get(':id')
  @Permiso('clientes', 'ver')
  async obtenerFicha(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.obtenerFichaAdmin(id, req.usuario, ip);
  }

  @Post()
  @Permiso('clientes', 'editar')
  async crearEnMostrador(@Body() dto: RegistrarMostradorDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.crearEnMostrador(dto, req.usuario?.partyId, ip);
  }

  @Patch(':id')
  @Permiso('clientes', 'editar')
  async editar(
    @Param('id') id: string,
    @Body() dto: EditarClienteAdminDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.editarCliente(id, dto, req.usuario?.partyId, ip);
  }

  @Patch(':id/estado')
  @Permiso('clientes', 'editar')
  async cambiarEstado(
    @Param('id') id: string,
    @Body('activo') activo: boolean,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.cambiarEstado(id, activo, req.usuario?.partyId, ip);
  }

  @Post(':id/ajustar-puntos')
  @Permiso('puntos', 'ajustar')
  async ajustarPuntos(
    @Param('id') id: string,
    @Body() dto: AjustarPuntosDto,
    @Req() req: any,
  ) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.puntosService.ajustarManual(
      id,
      dto,
      req.usuario?.partyId,
      ip,
    );
  }

  @Get(':id/puntos-historial')
  @Permiso('puntos', 'ver')
  async listarHistorialPuntos(@Param('id') id: string) {
    return this.puntosService.listarMovimientos(id);
  }
}
