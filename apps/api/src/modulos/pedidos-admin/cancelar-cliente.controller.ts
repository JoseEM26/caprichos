import { Body, Controller, Param, Post, Query } from '@nestjs/common';
import { CancelarClienteService } from './cancelar-cliente.service';

/** Cancelar el pedido desde la carta: público, el acceso lo da el token `t` del seguimiento. */
@Controller('carta')
export class CancelarClienteController {
  constructor(private readonly servicio: CancelarClienteService) {}

  @Post('pedidos/:codigo/cancelar')
  async cancelar(@Param('codigo') codigo: string, @Query('t') token: string | undefined, @Body() cuerpo: { motivo?: unknown }) {
    const motivo = typeof cuerpo?.motivo === 'string' ? cuerpo.motivo : undefined;
    const r = await this.servicio.cancelarPorToken(codigo, token, motivo);
    return { ok: true, codigo: r.codigo };
  }
}
