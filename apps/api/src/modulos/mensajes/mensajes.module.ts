import { Module } from '@nestjs/common';
import { MensajesController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';
import { WHATSAPP_GATEWAY } from './whatsapp.gateway';
import { WhatsAppLocalGateway } from './whatsapp-local.gateway';

@Module({
  controllers: [MensajesController],
  // Al llegar las credenciales de Meta: cambiar useClass por WhatsAppCloudGateway (único cambio).
  providers: [MensajesService, { provide: WHATSAPP_GATEWAY, useClass: WhatsAppLocalGateway }],
  exports: [MensajesService],
})
export class MensajesModule {}
