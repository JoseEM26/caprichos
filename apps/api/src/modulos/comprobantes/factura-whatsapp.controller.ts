import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccesoGuard } from '../acceso/acceso.guard';
import { Permiso } from '../acceso/permiso.decorator';
import { FacturaWhatsappService } from './factura-whatsapp.service';

/** Interruptor y plantilla del envío de facturas por WhatsApp (ADMIN; la web pide Sí/No). */
export class ConfigFacturaWhatsappDto {
  @IsBoolean({ message: 'La marca debe ser sí o no' })
  activo!: boolean;

  /** Nombre de la plantilla de Meta con encabezado de documento (minúsculas, números y guion bajo). Vacío: sin plantilla. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  plantilla?: string;
}

@Controller('admin/comprobantes')
@UseGuards(AccesoGuard)
export class FacturaWhatsappController {
  constructor(private readonly servicio: FacturaWhatsappService) {}

  /** GET /admin/comprobantes/config/factura-whatsapp */
  @Get('config/factura-whatsapp')
  @Permiso('comprobantes', 'ver')
  async obtener() {
    return this.servicio.leerConfig();
  }

  /** PUT /admin/comprobantes/config/factura-whatsapp */
  @Put('config/factura-whatsapp')
  @Permiso('configuracion', 'editar')
  async guardar(@Body() dto: ConfigFacturaWhatsappDto, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.servicio.guardarConfig(dto.activo, dto.plantilla, req.usuario, ip);
  }

  /** POST /admin/comprobantes/:id/reenviar-whatsapp : vuelve a mandar la factura por el mismo camino (respeta la ventana de 24 h). */
  @Post(':id/reenviar-whatsapp')
  @Permiso('comprobantes', 'emitir')
  async reenviar(@Param('id') id: string, @Req() req: any) {
    const ip = (req.ip || req.headers?.['x-forwarded-for']) as string | undefined;
    return this.servicio.reenviar(id, req.usuario, ip);
  }
}
