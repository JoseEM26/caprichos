import { Module } from '@nestjs/common';
import { RepartosController } from './repartos.controller';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [ChatbotModule],
  controllers: [RepartosController],
  providers: [RepartosService, RutaService],
  exports: [RepartosService, RutaService],
})
export class RepartosModule {}
