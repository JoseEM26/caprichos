import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { WhatsappWebhookService } from '../servicios/whatsapp-webhook.service';

interface RequestConRawBody extends Request {
  rawBody?: Buffer;
}

@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly webhookService: WhatsappWebhookService) {}

  /**
   * Verificación inicial del Webhook solicitada por Meta (GET /whatsapp/webhook).
   * Devuelve hub.challenge si hub.verify_token coincide con WHATSAPP_VERIFY_TOKEN.
   */
  @Get()
  verificar(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const respuestaChallenge = this.webhookService.verificarSuscripcion(
      mode,
      verifyToken,
      challenge,
    );
    res.setHeader('Content-Type', 'text/plain');
    return res.status(HttpStatus.OK).send(respuestaChallenge);
  }

  /**
   * Recepción de eventos y mensajes de WhatsApp (POST /whatsapp/webhook).
   * Valida estrictamente la firma criptográfica X-Hub-Signature-256 sobre req.rawBody.
   * Rechaza 401 Unauthorized si la firma falta o no coincide.
   * Responde 200 OK inmediatamente a Meta de forma idempotente.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async recibir(
    @Req() req: RequestConRawBody,
    @Headers('x-hub-signature-256') signature: string,
    @Body() body: any,
  ) {
    // Si req.rawBody está presente por la opción de NestFactory, se usa directamente;
    // de lo contrario, se genera a partir de body serializado (compatibilidad de pruebas).
    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(body || {}), 'utf8');

    const firmaValida = this.webhookService.validarFirma(rawBodyBuffer, signature);
    if (!firmaValida) {
      throw new UnauthorizedException({
        codigo: 'FIRMA_INVALIDA',
        mensaje: 'La firma X-Hub-Signature-256 es requerida y debe coincidir con WHATSAPP_APP_SECRET',
      });
    }

    const resultado = await this.webhookService.procesarPayload(body);
    return { status: 'ok', ok: true, ...resultado };
  }
}
