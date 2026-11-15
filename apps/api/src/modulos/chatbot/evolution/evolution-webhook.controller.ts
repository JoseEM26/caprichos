import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Query, UnauthorizedException } from '@nestjs/common';
import { EvolutionWebhookService } from './evolution-webhook.service';

/** POST /whatsapp/evolution/webhook — eventos de Evolution API (messages.upsert y connection.update). */
@Controller('whatsapp/evolution/webhook')
export class EvolutionWebhookController {
  constructor(private readonly servicio: EvolutionWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async recibir(
    @Headers('x-evolution-token') cabecera: string | undefined,
    @Headers('authorization') autorizacion: string | undefined,
    @Query('token') consulta: string | undefined,
    @Body() body: any,
  ) {
    const token = cabecera || autorizacion?.replace(/^Bearer\s+/i, '') || consulta;
    if (!this.servicio.validarToken(token)) {
      throw new UnauthorizedException({ codigo: 'TOKEN_INVALIDO', mensaje: 'El token del webhook de Evolution falta o no coincide' });
    }
    return { ok: true, ...(await this.servicio.procesar(body)) };
  }
}
