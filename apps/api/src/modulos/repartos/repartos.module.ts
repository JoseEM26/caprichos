import { Module } from '@nestjs/common';
import { RepartosController } from './repartos.controller';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { MensajesModule } from '../mensajes/mensajes.module';
import { UbicacionRepartidorService } from './ubicacion-repartidor.service';
import { StockModule } from '../stock/stock.module';
import { RepartosChatService } from './repartos-chat.service';

@Module({
  imports: [ChatbotModule, MensajesModule, StockModule],
  controllers: [RepartosController],
  providers: [RepartosService, RutaService, RepartosChatService, UbicacionRepartidorService],
  exports: [RepartosService, RutaService],
})
export class RepartosModule {}
