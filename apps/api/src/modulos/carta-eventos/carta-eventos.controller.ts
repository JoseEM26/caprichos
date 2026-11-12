import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CartaEventosService, type EventoEntrante } from './carta-eventos.service';

/** Endpoint público de la carta (sin sesión). Siempre 204: un evento perdido nunca debe molestar a quien pide. */
@Controller('carta/eventos')
export class CartaEventosController {
  constructor(private readonly eventos: CartaEventosService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async registrar(@Body() body: EventoEntrante, @Req() req?: Request): Promise<void> {
    await this.eventos.registrar(body, req?.ip);
  }
}
