import { Module, forwardRef } from '@nestjs/common';
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports: [forwardRef(() => ChatbotModule)],
  controllers: [ReservasController],
  providers: [ReservasService],
  exports: [ReservasService],
})
export class ReservasModule {}
