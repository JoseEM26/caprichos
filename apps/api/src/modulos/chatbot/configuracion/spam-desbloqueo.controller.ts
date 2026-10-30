import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { ChatbotConfiguracionService } from './chatbot-configuracion.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Desbloqueo manual de un chat bloqueado por spam (Mensajes). Motivo obligatorio; auditado. */
@Controller('admin/mensajes')
@UseGuards(AccesoGuard)
export class SpamDesbloqueoController {
  constructor(private readonly configuracion: ChatbotConfiguracionService) {}

  @Post(':id/desbloquear-spam')
  @Permiso('mensajes', 'enviar')
  desbloquear(@Param('id') id: string, @Body('motivo') motivo: unknown, @Req() req: any) {
    return this.configuracion.desbloquearSpam(BigInt(id), motivo, req.usuario, ipDe(req));
  }
}
