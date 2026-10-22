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
import { CrearPedidoDto } from './dto/crear-pedido.dto';

@Controller('pedidos')
export class PedidosController {
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly clientesService: ClientesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearPedidoDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() req?: Request,
  ) {
    // si quien pide tiene su cuenta abierta (cookie), el pedido queda a su nombre y suma puntos
    const cliente = req ? await this.clientesService.clienteDesdeRequest(req).catch(() => null) : null;
    return this.pedidosService.crear(dto, idempotencyKey, cliente ? { canal: 'CARTA', clientePartyId: cliente.partyId } : undefined);
  }
}
