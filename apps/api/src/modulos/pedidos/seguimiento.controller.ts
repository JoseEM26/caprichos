import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ClientesService } from '../clientes/clientes.service';
import { MAX_PEDIDOS_LOTE, SeguimientoService } from './seguimiento.service';

/**
 * Seguimiento público del pedido para el invitado de la carta (sin sesión).
 * El acceso lo da el token `t`, no el código del pedido.
 */
@Controller('carta')
export class SeguimientoController {
  constructor(
    private readonly seguimientoService: SeguimientoService,
    private readonly clientesService: ClientesService,
  ) {}

  @Get('seguimiento/:codigo')
  async obtener(@Param('codigo') codigo: string, @Query('t') token?: string) {
    return this.seguimientoService.obtener(codigo, token);
  }

  @Post('seguimiento/lote')
  async obtenerLote(@Body() cuerpo: { pedidos?: unknown }) {
    const pedidos = cuerpo?.pedidos;
    if (!Array.isArray(pedidos) || pedidos.length > MAX_PEDIDOS_LOTE) {
      throw new BadRequestException({
        codigo: 'LOTE_INVALIDO',
        mensaje: `Envía una lista de hasta ${MAX_PEDIDOS_LOTE} pedidos.`,
      });
    }
    const entradas = pedidos.map((p) => ({
      codigo: typeof p?.codigo === 'string' ? p.codigo : '',
      t: typeof p?.t === 'string' ? p.t : undefined,
    }));
    return { resultados: await this.seguimientoService.obtenerLote(entradas) };
  }

  @Get('cuenta/pedidos')
  async pedidosCuenta(@Req() req: Request, @Query('pagina') pagina?: string) {
    const cliente = await this.clientesService.clienteDesdeRequest(req);
    if (!cliente) {
      throw new UnauthorizedException({
        codigo: 'SESION_REQUERIDA',
        mensaje: 'Inicia sesión para ver tus pedidos.',
      });
    }
    const numero = Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1);
    return this.seguimientoService.pedidosDeCuenta(BigInt(cliente.partyId), numero);
  }
}
