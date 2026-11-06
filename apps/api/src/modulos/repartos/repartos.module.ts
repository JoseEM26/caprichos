import { Module } from '@nestjs/common';
import { RepartosController } from './repartos.controller';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { RepartosChatService } from './repartos-chat.service';

@Module({
  imports: [ChatbotModule, MensajesModule],
  controllers: [RepartosController],
  providers: [RepartosService, RutaService, RepartosChatService],
  exports: [RepartosService, RutaService],
})
export class RepartosModule {}
