import {
  BadRequestException,
  Body,
  Controller,
  GoneException,
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
import { DireccionesClienteService } from './direcciones-cliente.service';
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
    private readonly direcciones: DireccionesClienteService,
  ) {}

  /** Cliente con cuenta por celular exacto (9 dígitos) para atender un pedido. */
  @Get('por-telefono/:telefono')
  @Permiso([
    { modulo: 'pedidos', accion: 'crear' },
    { modulo: 'clientes', accion: 'ver' },
  ])
  async buscarPorTelefono(@Param('telefono') telefono: string, @Req() req: any) {
    if (!/^9\d{8}$/.test(telefono ?? '')) {
      throw new BadRequestException({ codigo: 'TELEFONO_INVALIDO', mensaje: 'El celular debe tener 9 dígitos y empezar con 9.' });
    }
    return this.direcciones.buscarPorTelefono(telefono, req.usuario?.partyId);
  }

  /** Retirada: los clientes ya no se buscan por DNI. */
  @Get('por-dni/:dni')
  @Permiso([
    { modulo: 'pedidos', accion: 'crear' },
    { modulo: 'clientes', accion: 'ver' },
  ])
  buscarPorDniRetirado(): never {
    throw new GoneException({
      codigo: 'BUSQUEDA_DNI_RETIRADA',
      mensaje: 'Los clientes ya no se buscan por DNI. Busca por celular.',
    });
  }

  @Get()
  @Permiso('clientes', 'ver')
  async listar(
    @Query('q') q?: string,
    @Query('tipo') tipo?: string,
    @Query('estado') estado?: string,
    @Query('creditoPersonal') creditoPersonal?: string,
    @Query('verificacion') verificacion?: string,
    @Query('gastaPuntos') gastaPuntos?: string,
    @Query('pagina') pagina?: string,
    @Query('limite') limite?: string,
    @Req() req?: any,
  ) {
    const ip = (req?.ip || req?.headers?.['x-forwarded-for']) as string | undefined;
    if (verificacion && !['verificados', 'sin_verificar', 'todos'].includes(verificacion)) {
      throw new BadRequestException({ codigo: 'FILTRO_INVALIDO', mensaje: 'verificacion: verificados, sin_verificar o todos.' });
    }
    if (gastaPuntos && !['si', 'no'].includes(gastaPuntos)) {
      throw new BadRequestException({ codigo: 'FILTRO_INVALIDO', mensaje: 'gastaPuntos: si.' });
    }
    return this.clientesService.listarAdmin(
      {
        q,
        tipo,
        estado,
        creditoPersonal,
        verificacion: verificacion as any,
        gastaPuntos: gastaPuntos === 'si' ? 'si' : undefined,
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
