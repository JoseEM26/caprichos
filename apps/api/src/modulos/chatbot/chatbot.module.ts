import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { LocalModule } from '../local/local.module';
import { WhatsappWebhookController } from './controladores/whatsapp-webhook.controller';
import { QuejasWhatsappController } from './controladores/quejas-whatsapp.controller';
import { WhatsAppMetaAdaptador } from './adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from './adaptadores/whatsapp-simulado.adaptador';
import { WhatsAppMensajeriaProvider } from './proveedor/whatsapp-mensajeria.proveedor';
import { WhatsappWebhookService } from './servicios/whatsapp-webhook.service';
import { Ventana24hService } from './servicios/ventana-24h.service';
import { ChatbotPlanificadorService } from './servicios/chatbot-planificador.service';
import { QuejasWhatsappService } from './servicios/quejas-whatsapp.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from './puerto/whatsapp-mensajeria.puerto';
import { EjecutorConversacionService } from './conversacion/ejecutor-conversacion.service';

@Module({
  imports: [ComunModule, ArchivosModule, AuditoriaModule, LocalModule],
  controllers: [WhatsappWebhookController, QuejasWhatsappController],
  providers: [
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    WhatsAppMensajeriaProvider,
    WhatsappWebhookService,
    Ventana24hService,
    ChatbotPlanificadorService,
    QuejasWhatsappService,
    EjecutorConversacionService,
  ],
  exports: [
    WHATSAPP_MENSAJERIA_PUERTO,
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    Ventana24hService,
    ChatbotPlanificadorService,
    QuejasWhatsappService,
    WhatsappWebhookService,
    EjecutorConversacionService,
  ],
})
export class ChatbotModule {}
