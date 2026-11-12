import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClientesService } from '../clientes/clientes.service';
import { PedidosService } from './pedidos.service';
import { CartaEventosService } from '../carta-eventos';
import { CrearPedidoDto, PistaDireccionDto } from './dto/crear-pedido.dto';

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly clientesService: ClientesService,
    private readonly cartaEventos: CartaEventosService,
  ) {}

  /** Pista pública (carta sin sesión): zona y dirección enmascarada del último pedido de ese celular. */
  @Post('pista-direccion')
  @HttpCode(HttpStatus.OK)
  async pistaDireccion(@Body() dto: PistaDireccionDto, @Req() req?: Request) {
    return this.pedidosService.pistaUltimaDireccion(dto.telefono, req?.ip);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearPedidoDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
    @Headers('x-carta-sesion') sesionCarta?: string,
  ) {
    // si quien pide tiene su cuenta abierta (cookie), el pedido queda a su nombre y suma puntos
    const cliente = req ? await this.clientesService.clienteDesdeRequest(req).catch(() => null) : null;
    const pedido = await this.pedidosService.crear(dto, idempotencyKey, cliente ? { canal: 'CARTA', clientePartyId: cliente.partyId } : undefined);
    // Embudo de la carta: enlaza el pedido con la sesión anónima del navegador (cabecera opcional); jamás rompe el pedido
    void this.cartaEventos.enlazarPedido(pedido.id, sesionCarta).catch(() => undefined);
    return pedido;
  }
}
