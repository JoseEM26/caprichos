import { Module, forwardRef } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { ArchivosModule } from '../archivos/archivos.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { LocalModule } from '../local/local.module';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { OfertasModule } from '../ofertas/ofertas.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ZonasModule } from '../zonas/zonas.module';
import { ClientesModule } from '../clientes/clientes.module';
import { ClientesService } from '../clientes/clientes.service';
import { CUENTA_CLIENTE_BOT_PUERTO } from './puerto/cuenta-cliente-bot.puerto';
import { ReservasModule } from '../reservas/reservas.module';
import { ChatbotIaModule } from './ia/chatbot-ia.module';
import { ChatbotConfiguracionModule } from './configuracion/chatbot-configuracion.module';
import { AvisosInternosModule } from './avisos-internos/avisos-internos.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { WhatsappWebhookController } from './controladores/whatsapp-webhook.controller';
import { QuejasWhatsappController } from './controladores/quejas-whatsapp.controller';
import { WhatsAppMetaAdaptador } from './adaptadores/whatsapp-meta.adaptador';
import { WhatsAppSimuladoAdaptador } from './adaptadores/whatsapp-simulado.adaptador';
import { WhatsAppMensajeriaProvider } from './proveedor/whatsapp-mensajeria.proveedor';
import { WhatsappWebhookService } from './servicios/whatsapp-webhook.service';
import { Ventana24hService } from './servicios/ventana-24h.service';
import { VigilanteSinRespuestaService } from './servicios/vigilante-sin-respuesta.service';
import { ChatbotPlanificadorService } from './servicios/chatbot-planificador.service';
import { AvisosPedidoService } from './servicios/avisos-pedido.service';
import { ReprogramacionService } from './servicios/reprogramacion.service';
import { OutboxWhatsappService } from './servicios/outbox-whatsapp.service';
import { AdminWhatsappSalientesController } from './controladores/admin-whatsapp-salientes.controller';
import { UbicacionWhatsappController } from './controladores/ubicacion-whatsapp.controller';
import { StockModule } from '../stock/stock.module';
import { DireccionesModule } from '../direcciones/direcciones.module';
import { AccesoModule } from '../acceso/acceso.module';
import { RecordatorioReservasTarea } from './servicios/recordatorio-reservas.tarea';
import { TareaRecordatorioPagoService } from './servicios/tarea-recordatorio-pago.service';
import { ReanudacionBotService } from './servicios/reanudacion-bot.service';
import { QuejasWhatsappService } from './servicios/quejas-whatsapp.service';
import { NumerosBloqueadosController } from './controladores/numeros-bloqueados.controller';
import { NumerosWhatsappService } from './servicios/numeros-whatsapp.service';
import { WHATSAPP_MENSAJERIA_PUERTO } from './puerto/whatsapp-mensajeria.puerto';
import { EjecutorConversacionService } from './conversacion/ejecutor-conversacion.service';
import { ColaWebhookService } from './servicios/cola-webhook.service';

@Module({
  imports: [
    ComunModule,
    ArchivosModule,
    AuditoriaModule,
    LocalModule,
    CatalogoModule,
    OfertasModule,
    forwardRef(() => PedidosModule),
    ZonasModule,
    ClientesModule,
    forwardRef(() => ReservasModule),
    ChatbotIaModule,
    ChatbotConfiguracionModule,
    forwardRef(() => AvisosInternosModule),
    forwardRef(() => StockModule),
    forwardRef(() => VouchersModule),
    AccesoModule,
    DireccionesModule,
  ],
  controllers: [NumerosBloqueadosController, WhatsappWebhookController, QuejasWhatsappController, AdminWhatsappSalientesController, UbicacionWhatsappController],
  providers: [
    { provide: CUENTA_CLIENTE_BOT_PUERTO, useExisting: ClientesService },
    NumerosWhatsappService,
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    WhatsAppMensajeriaProvider,
    WhatsappWebhookService,
    Ventana24hService,
    AvisosPedidoService,
    ReprogramacionService,
    OutboxWhatsappService,
    ChatbotPlanificadorService,
    VigilanteSinRespuestaService,
    RecordatorioReservasTarea,
    TareaRecordatorioPagoService,
    ReanudacionBotService,
    QuejasWhatsappService,
    EjecutorConversacionService,
    ColaWebhookService,
  ],
  exports: [
    NumerosWhatsappService,
    WHATSAPP_MENSAJERIA_PUERTO,
    WhatsAppMetaAdaptador,
    WhatsAppSimuladoAdaptador,
    Ventana24hService,
    AvisosPedidoService,
    OutboxWhatsappService,
    ChatbotPlanificadorService,
    RecordatorioReservasTarea,
    TareaRecordatorioPagoService,
    ReanudacionBotService,
    QuejasWhatsappService,
    WhatsappWebhookService,
    EjecutorConversacionService,
    ColaWebhookService,
    ChatbotIaModule,
    ChatbotConfiguracionModule,
  ],
})
export class ChatbotModule {}
