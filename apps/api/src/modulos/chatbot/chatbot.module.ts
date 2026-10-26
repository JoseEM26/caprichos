import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { LocalModule } from '../local/local.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ZonasModule } from '../zonas/zonas.module';
import { ReservasModule } from '../reservas/reservas.module';
import { ChatbotIaModule } from './ia/chatbot-ia.module';
import { ChatbotConfiguracionModule } from './configuracion/chatbot-configuracion.module';
import { AvisosInternosModule } from './avisos-internos/avisos-internos.module';
import { WhatsappWebhookController } from './controladores/whatsapp-webhook.controller';
import { QuejasWhatsappController } from './controladores/quejas-whatsapp.controller';
import { WhatsAppMetaAdaptador } from './adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from './adaptadores/whatsapp-simulado.adaptador';
import { WhatsAppMensajeriaProvider } from './proveedor/whatsapp-mensajeria.proveedor';
import { WhatsappWebhookService } from './servicios/whatsapp-webhook.service';
import { Ventana24hService } from './servicios/ventana-24h.service';
import { ChatbotPlanificadorService } from './servicios/chatbot-planificador.service';
import { RecordatorioReservasTarea } from './servicios/recordatorio-reservas.tarea';
import { TareaRecordatorioPagoService } from './servicios/tarea-recordatorio-pago.service';
import { QuejasWhatsappService } from './servicios/quejas-whatsapp.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from './puerto/whatsapp-mensajeria.puerto';
import { EjecutorConversacionService } from './conversacion/ejecutor-conversacion.service';

@Module({
  imports: [
    ComunModule,
    ArchivosModule,
    AuditoriaModule,
    LocalModule,
    CatalogoModule,
    OfertasModule,
    PedidosModule,
    ZonasModule,
    forwardRef(() => ReservasModule),
    ChatbotIaModule,
    ChatbotConfiguracionModule,
    forwardRef(() => AvisosInternosModule),
  ],
  controllers: [WhatsappWebhookController, QuejasWhatsappController],
  providers: [
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    WhatsAppMensajeriaProvider,
    WhatsappWebhookService,
    Ventana24hService,
    ChatbotPlanificadorService,
    RecordatorioReservasTarea,
    TareaRecordatorioPagoService,
    QuejasWhatsappService,
    EjecutorConversacionService,
  ],
  exports: [
    WHATSAPP_MENSAJERIA_PUERTO,
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    Ventana24hService,
    ChatbotPlanificadorService,
    RecordatorioReservasTarea,
    TareaRecordatorioPagoService,
    QuejasWhatsappService,
    WhatsappWebhookService,
    EjecutorConversacionService,
    ChatbotIaModule,
    ChatbotConfiguracionModule,
    AvisosInternosModule,
  ],
})
export class ChatbotModule {}
