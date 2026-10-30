import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { OutboxWhatsappService } from '../servicios/outbox-whatsapp.service';

export class DescartarSalienteDto {
  @IsString()
  @Length(3, 200)
  motivo!: string;
}

const ESTADOS_VALIDOS = ['PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO', 'DESCARTADO'];

/** Pestaña Salientes de Mensajes: cola de WhatsApp saliente, dead letter y reenvío o descarte auditados. */
@Controller(['admin/whatsapp', 'api/admin/whatsapp'])
@UseGuards(AccesoGuard)
export class AdminWhatsappSalientesController {
  constructor(private readonly outbox: OutboxWhatsappService) {}

  @Get('salientes')
  @Permiso('whatsapp_salientes', 'ver')
  async listar(@Query('estado') estado?: string, @Query('pagina') pagina?: string) {
    const estadoValido = estado && ESTADOS_VALIDOS.includes(estado) ? estado : undefined;
    const pag = Math.max(1, parseInt(pagina ?? '1', 10) || 1);
    return this.outbox.listar(estadoValido, pag);
  }

  @Get('salientes/resumen')
  @Permiso('whatsapp_salientes', 'ver')
  async resumen() {
    return this.outbox.resumen();
  }

  @Post('salientes/:id/reenviar')
  @Permiso('whatsapp_salientes', 'reenviar')
  async reenviar(@Param('id') id: string, @Req() req: any) {
    await this.outbox.reenviar(id, req.usuario);
    return { ok: true };
  }

  @Post('salientes/:id/descartar')
  @Permiso('whatsapp_salientes', 'descartar')
  async descartar(@Param('id') id: string, @Body() dto: DescartarSalienteDto, @Req() req: any) {
    await this.outbox.descartar(id, dto.motivo.trim(), req.usuario);
    return { ok: true };
  }
}
