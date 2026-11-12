import { Module } from '@nestjs/common';
import { TiemposController } from './tiempos/tiempos.controller';
import { TiemposService } from './tiempos/tiempos.service';
import { DemandaController } from './demanda/demanda.controller';
import { DemandaService } from './demanda/demanda.service';
import { VentasController } from './ventas/ventas.controller';
import { VentasService } from './ventas/ventas.service';
import { ClientesAnalisisController } from './clientes/clientes.controller';
import { ClientesAnalisisService } from './clientes/clientes.service';
import { WhatsappAnalisisController } from './whatsapp/whatsapp.controller';
import { WhatsappAnalisisService } from './whatsapp/whatsapp.service';
import { ChatbotModule } from '../chatbot';

/**
 * Módulo único de Análisis. Para sumar una pestaña (demanda, ventas, clientes…): crea su carpeta `<tema>/` con
 * `<tema>.controller.ts` (ruta `admin/analisis/<tema>`, permiso `analisis/ver`) y `<tema>.service.ts`,
 * y agrégalos a las dos listas de abajo. Los filtros y rangos comunes salen de `./comun/filtros`.
 */
@Module({
  // ChatbotModule re-exporta ChatbotConfiguracionModule (ConsumoWhatsappService, el contador de mensajes del mes)
  imports: [ChatbotModule],
  controllers: [
    TiemposController,
    DemandaController,
    VentasController,
    ClientesAnalisisController,
    WhatsappAnalisisController,
  ],
  providers: [
    TiemposService,
    DemandaService,
    VentasService,
    ClientesAnalisisService,
    WhatsappAnalisisService,
  ],
})
export class AnalisisModule {}
