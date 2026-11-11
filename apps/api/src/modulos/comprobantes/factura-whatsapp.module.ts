import { Module } from '@nestjs/common';
import { ArchivosModule } from '../archivos';
import { ChatbotModule } from '../chatbot';
import { ComprobantesModule } from './comprobantes.module';
import { FacturaWhatsappController } from './factura-whatsapp.controller';
import { FacturaWhatsappService } from './factura-whatsapp.service';

/**
 * Factura aceptada por SUNAT → WhatsApp del cliente. Módulo aparte: ComprobantesModule no puede importar ChatbotModule
 * (Chatbot → Pedidos → Comprobantes sería un ciclo); este se engancha por el aviso `alAceptarFactura`.
 */
@Module({
  imports: [ComprobantesModule, ChatbotModule, ArchivosModule],
  controllers: [FacturaWhatsappController],
  providers: [FacturaWhatsappService],
})
export class FacturaWhatsappModule {}
