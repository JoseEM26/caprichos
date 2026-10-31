import { BadRequestException, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AccesoGuard } from '../../acceso/acceso.guard';
import { Permiso } from '../../acceso/permiso.decorator';
import { ubicacionValida, UbicacionCliente } from '../servicios/ubicacion-cliente.util';

const VENTANA_MS = 24 * 60 * 60 * 1000;

/** Pedido delivery de Caja y mozo: la última ubicación que el cliente de ese celular mandó por WhatsApp (24 h). */
@Controller('admin/clientes')
@UseGuards(AccesoGuard)
export class UbicacionWhatsappController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('ubicacion-whatsapp/:telefono')
  @Permiso([
    { modulo: 'pedidos', accion: 'crear' },
    { modulo: 'clientes', accion: 'ver' },
  ])
  async ubicacionReciente(@Param('telefono') telefono: string) {
    if (!/^9\d{8}$/.test(telefono ?? '')) {
      throw new BadRequestException({ codigo: 'TELEFONO_INVALIDO', mensaje: 'El celular debe tener 9 dígitos y empezar con 9.' });
    }
    const vacio = { encontrada: false, lat: null, lng: null, direccion: null, direccionAprox: null, en: null };
    const conversaciones = await this.prisma.conversacion.findMany({
      where: { telefono: { endsWith: telefono } },
      select: { id: true },
    });
    if (conversaciones.length === 0) return vacio;

    const mensajes = await this.prisma.mensajeChat.findMany({
      where: {
        conversacion_id: { in: conversaciones.map((c) => c.id) },
        direccion: 'ENTRA',
        autor: 'CLIENTE',
        en: { gte: new Date(Date.now() - VENTANA_MS) },
      },
      orderBy: { en: 'desc' },
      select: { en: true, contenido: true },
      take: 50,
    });

    for (const m of mensajes) {
      const ub = ((m.contenido as any)?.ubicacion ?? null) as (UbicacionCliente & { direccion?: string }) | null;
      if (ub && ubicacionValida(ub.lat, ub.lng)) {
        return {
          encontrada: true,
          lat: ub.lat,
          lng: ub.lng,
          direccion: ub.direccion ?? null,
          direccionAprox: ub.direccionAprox ?? null,
          en: m.en,
        };
      }
    }
    return vacio;
  }
}
