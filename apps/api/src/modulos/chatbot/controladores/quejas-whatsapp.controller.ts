import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { QuejasWhatsappService } from '../servicios/quejas-whatsapp.service';
import {
  WHATSAPP_MENSAJERIA_PUERTO,
  WhatsAppMensajeriaPuerto,
} from '../puerto/whatsapp-mensajeria.puerto';

@Controller('admin/reclamos/whatsapp')
@UseGuards(AccesoGuard)
export class QuejasWhatsappController {
  constructor(
    private readonly quejasService: QuejasWhatsappService,
    @Inject(WHATSAPP_MENSAJERIA_PUERTO)
    private readonly mensajeria: WhatsAppMensajeriaPuerto,
  ) {}

  /**
   * Lista las quejas informales de WhatsApp y el resumen de satisfacción para el módulo de Reclamos.
   */
  @Get()
  @Permiso('reclamos', 'ver')
  async listar(
    @Query('estado') estado?: string,
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
    @Req() req?: any,
  ) {
    return this.quejasService.listarQuejas(
      { estado, pagina, limite },
      req?.usuario,
    );
  }

  /**
   * Devuelve el estado de conexión actual con WhatsApp (Meta o Simulado).
   * Solo lectura: NUNCA expone credenciales ni secretos.
   */
  @Get('estado-conexion')
  @Permiso('configuracion', 'ver')
  obtenerEstadoConexion() {
    return this.mensajeria.estaConectado();
  }

  /**
   * Obtiene el detalle de una queja específica de WhatsApp.
   */
  @Get(':id')
  @Permiso('reclamos', 'ver')
  async obtenerDetalle(@Param('id') id: string) {
    return this.quejasService.obtenerDetalle(id);
  }

  /**
   * Cambia el estado de una queja (EN_REVISION o RESUELTA) con nota explicativa.
   */
  @Post(':id/estado')
  @Permiso('reclamos', 'responder')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: { estado: 'EN_REVISION' | 'RESUELTA'; nota?: string },
    @Req() req: any,
  ) {
    const rawIp = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    const ip = rawIp ? (rawIp.split(',')[0] || '').trim() : undefined;
    return this.quejasService.cambiarEstado(id, dto, req.usuario, ip);
  }
}
