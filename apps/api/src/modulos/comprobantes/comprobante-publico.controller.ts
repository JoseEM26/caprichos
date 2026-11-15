import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { ComprobantesService } from './comprobantes.service';
import { verificarTokenPdfComprobante } from './comprobante-enlace';

/**
 * PDF de un comprobante para el cliente (enlace que el local manda por WhatsApp). Sin sesión: el acceso lo da el token
 * firmado de ESE comprobante. No lista nada; id o token malos dan el mismo 404.
 */
@Controller('carta/comprobante')
export class ComprobantePublicoController {
  constructor(private readonly comprobantes: ComprobantesService) {}

  @Get(':id/:token')
  async pdf(@Param('id') id: string, @Param('token') token: string, @Res() res: Response) {
    if (!/^\d{1,18}$/.test(id) || !verificarTokenPdfComprobante(id, token)) {
      throw new NotFoundException({ codigo: 'COMPROBANTE_NO_ENCONTRADO', mensaje: 'El enlace no es válido' });
    }
    const pdf = await this.comprobantes.pdfParaEnvio(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.nombre.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf.contenido);
  }
}
