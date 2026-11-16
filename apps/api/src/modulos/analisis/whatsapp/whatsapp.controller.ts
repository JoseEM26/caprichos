import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { WhatsappAnalisisService } from './whatsapp.service';
import { SaludBotAnalisisService } from './salud.service';

/** Análisis › WhatsApp. Solo ADMIN y SUPERVISOR (permiso analisis/ver). El desglose por persona es solo del ADMIN. */
@Controller('admin/analisis/whatsapp')
@UseGuards(AccesoGuard)
export class WhatsappAnalisisController {
  constructor(
    private readonly whatsapp: WhatsappAnalisisService,
    private readonly salud: SaludBotAnalisisService,
  ) {}

  /** Salud del bot: salientes contra los topes anti-baneo, descartes, respuestas del bot, pausas y encuestas. Solo agregados, sin celulares. */
  @Get('salud')
  @Permiso('analisis', 'ver')
  saludBot(@Query() q: { desde?: string; hasta?: string }) {
    return this.salud.resumen(q);
  }

  @Get()
  @Permiso('analisis', 'ver')
  resumen(@Query() q: { desde?: string; hasta?: string }, @Req() req?: any) {
    const roles = (req?.usuario?.roles ?? [req?.usuario?.rol ?? '']).map((r: unknown) => String(r || '').toUpperCase());
    return this.whatsapp.resumen(q, roles.includes('ADMIN'));
  }

  @Get('sin-respuesta')
  @Permiso('analisis', 'ver')
  sinRespuesta() {
    return this.whatsapp.sinRespuestaAhora();
  }
}
