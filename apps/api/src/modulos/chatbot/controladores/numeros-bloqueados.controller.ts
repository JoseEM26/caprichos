import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { NumerosWhatsappService } from '../servicios/numeros-whatsapp.service';

const ipDe = (req: any): string | undefined => {
  const raw = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
  return raw ? (raw.split(',')[0] || '').trim() : undefined;
};

/** Lista manual de números bloqueados de WhatsApp. Solo ADMIN y SUPERVISOR (permiso mensajes/bloquear_numeros). */
@Controller(['admin/whatsapp', 'api/admin/whatsapp'])
@UseGuards(AccesoGuard)
export class NumerosBloqueadosController {
  constructor(private readonly numeros: NumerosWhatsappService) {}

  @Get('numeros-bloqueados')
  @Permiso('mensajes', 'bloquear_numeros')
  async listar() {
    return { filas: await this.numeros.listar(), propios: await this.numeros.listarPropios() };
  }

  @Post('numeros-bloqueados')
  @Permiso('mensajes', 'bloquear_numeros')
  bloquear(@Body() body: { celular?: unknown; motivo?: unknown }, @Req() req: any) {
    return this.numeros.bloquear(body?.celular, body?.motivo, req.usuario, ipDe(req));
  }

  @Post('numeros-bloqueados/desbloquear')
  @Permiso('mensajes', 'bloquear_numeros')
  desbloquearPost(@Body() body: { celular?: unknown }, @Req() req: any) {
    return this.numeros.desbloquear(body?.celular, req.usuario, ipDe(req));
  }

  @Delete('numeros-bloqueados/:celular')
  @Permiso('mensajes', 'bloquear_numeros')
  desbloquear(@Param('celular') celular: string, @Req() req: any) {
    return this.numeros.desbloquear(celular, req.usuario, ipDe(req));
  }
}
