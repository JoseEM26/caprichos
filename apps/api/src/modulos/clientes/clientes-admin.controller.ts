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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ClientesService } from './clientes.service';
import { FacturacionClienteService } from './facturacion-cliente.service';
import { DireccionesClienteService } from './direcciones-cliente.service';
import { PuntosService } from './puntos.service';
import { FiltrosClientesDto } from './clientes-filtros';
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
    private readonly facturacion: FacturacionClienteService,
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
    const r = await this.direcciones.buscarPorTelefono(telefono, req.usuario?.partyId);
    // RUC guardado en la cuenta para rellenar la factura (solo personal con permiso; nunca en la carta pública)
    return r.encontrado ? { ...r, facturacion: await this.facturacion.obtener(r.party) } : r;
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
  async listar(@Query() filtros: FiltrosClientesDto, @Req() req?: any) {
    const ip = (req?.ip || req?.headers?.['x-forwarded-for']) as string | undefined;
    return this.clientesService.listarAdmin(filtros, req?.usuario, ip);
  }

  /** Excel con todos los clientes del filtro actual (hasta 10.000). Solo ADMIN: lleva el celular completo. */
  @Get('exportar')
  @Permiso('clientes', 'ver')
  async exportar(@Query() filtros: FiltrosClientesDto, @Req() req: any, @Res() res: Response) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const r = await this.clientesService.exportarAdmin(filtros, req.usuario, ip);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${r.nombre}"`);
    res.setHeader('X-Filas', String(r.filas));
    res.send(Buffer.from(r.archivo));
  }

  /** Participantes de un sorteo en vivo con los mismos filtros: solo «María G.» y «···123» (se muestra en público). */
  @Get('participantes')
  @Permiso('clientes', 'ver')
  async participantes(@Query() filtros: FiltrosClientesDto) {
    return this.clientesService.participantesSorteo(filtros);
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
