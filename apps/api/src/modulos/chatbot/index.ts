/** API pública del módulo del chatbot de WhatsApp para otros módulos (regla de dependencias). */
export { ChatbotModule } from './chatbot.module';
export { Ventana24hService } from './servicios/ventana-24h.service';
export { esErrorPermanente } from './servicios/outbox-whatsapp.service';
export { WHATSAPP_MENSAJERIA_PUERTO } from './puerto/whatsapp-mensajeria.puerto';
export type { ResultadoEnvioWhatsApp, WhatsAppMensajeriaPuerto } from './puerto/whatsapp-mensajeria.puerto';
export { ConsumoWhatsappService } from './configuracion/consumo-whatsapp.service';
export { enmascararTelefono } from './utilidades/enmascarar.util';
