import { Module, forwardRef } from '@nestjs/common';
import { ReservasController } from './reservas.controller';
import { ReservasCartaController } from './reservas-carta.controller';
import { ReservasCartaService } from './reservas-carta.service';
import { ReservasService } from './reservas.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [forwardRef(() => ChatbotModule)],
  controllers: [ReservasController, ReservasCartaController],
  providers: [ReservasService, ReservasCartaService],
  exports: [ReservasService],
})
export class ReservasModule {}
