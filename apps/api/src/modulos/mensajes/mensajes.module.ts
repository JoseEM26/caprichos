import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { StockModule } from '../stock/stock.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';
import { PlantillasRespuestaService } from './plantillas-respuesta.service';
import { EnvioEncoladoService } from './envio-encolado.service';
import { WHATSAPP_GATEWAY } from './whatsapp.gateway';
import { WhatsAppMetaGateway } from './whatsapp-meta.gateway';
import { WhatsAppLocalGateway } from './whatsapp-local.gateway';

@Module({
  imports: [ComunModule, ChatbotModule, ArchivosModule, StockModule, ClientesModule],
  controllers: [MensajesController],
  providers: [
    MensajesService,
    EnvioEncoladoService,
    PlantillasRespuestaService,
    WhatsAppLocalGateway,
    WhatsAppMetaGateway,
    { provide: WHATSAPP_GATEWAY, useClass: WhatsAppMetaGateway },
  ],
  exports: [MensajesService, WHATSAPP_GATEWAY, WhatsAppMetaGateway],
})
export class MensajesModule {}
