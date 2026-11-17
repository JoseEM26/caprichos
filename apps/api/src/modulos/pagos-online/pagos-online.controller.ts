import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { ClientesService } from '../clientes/clientes.service';
import { PagosOnlineService } from './pagos-online.service';
import { CambioMedioDto, CargoDto, DevolverDto, IntentoDto } from './pagos-online.dto';

interface RequestConRawBody extends Request {
  rawBody?: Buffer;
}

/** Rutas públicas: la carta (pago) y el webhook de Culqi. */
@Controller()
export class PagosOnlinePublicoController {
  constructor(
    private readonly servicio: PagosOnlineService,
    private readonly clientes: ClientesService,
  ) {}

  @Get('carta/pagos/culqi/config')
  config() {
    return this.servicio.config();
  }

  @Post('carta/pagos/culqi/intento')
  @HttpCode(HttpStatus.OK)
  async intento(@Body() dto: IntentoDto, @Req() req: Request, @Headers('x-seguimiento-token') cabToken?: string) {
    const cliente = await this.clientes.clienteDesdeRequest(req).catch(() => null);
    return this.servicio.crearIntento(dto.pedidoId, { seguimientoToken: dto.seguimientoToken ?? cabToken, clientePartyId: cliente?.partyId != null ? BigInt(cliente.partyId) : null });
  }

  @Post('carta/pagos/culqi/cambiar-medio')
  @HttpCode(HttpStatus.OK)
  async cambiarMedio(@Body() dto: CambioMedioDto, @Req() req: Request, @Headers('x-seguimiento-token') cabToken?: string) {
    const cliente = await this.clientes.clienteDesdeRequest(req).catch(() => null);
    return this.servicio.cambiarMedioInvitado(dto.pedidoId, { seguimientoToken: dto.seguimientoToken ?? cabToken, clientePartyId: cliente?.partyId != null ? BigInt(cliente.partyId) : null }, dto);
  }

  @Post('carta/pagos/culqi/cargo')
  @HttpCode(HttpStatus.OK)
  cargo(@Body() dto: CargoDto) {
    return this.servicio.cargar(dto);
  }

  @Post('webhooks/culqi')
  @HttpCode(HttpStatus.OK)
  async webhook(@Req() req: RequestConRawBody, @Body() cuerpo: any, @Query('secreto') secreto?: string) {
    this.servicio.verificarWebhook(req.rawBody, req.headers, secreto);
    return this.servicio.recibirWebhook(cuerpo);
  }
}

@Controller('admin/pagos-online')
@UseGuards(AccesoGuard)
export class PagosOnlineAdminController {
  constructor(private readonly servicio: PagosOnlineService) {}

  @Get()
  @Permiso('pagos_online', 'ver')
  listar(@Query() q: { desde?: string; hasta?: string; estado?: string; pagina?: string }) {
    return this.servicio.listar(q);
  }

  /** Caja/ADMIN cambia el medio de un pedido que espera el pago en línea (E2). */
  @Post('pedidos/:id/cambiar-medio')
  @HttpCode(HttpStatus.OK)
  @Permiso('pedidos', 'cambiar_estado')
  cambiarMedio(@Param('id') id: string, @Body() dto: CambioMedioDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.servicio.cambiarMedioAdmin(id, dto, req.usuario, ip);
  }

  @Post(':id/devolver')
  @HttpCode(HttpStatus.OK)
  @Permiso('pagos_online', 'devolver')
  devolver(@Param('id') id: string, @Body() dto: DevolverDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.servicio.devolver(id, dto, req.usuario, ip);
  }
}
