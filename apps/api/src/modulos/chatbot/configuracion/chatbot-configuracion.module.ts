import { Module } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { ChatbotConfiguracionController } from './chatbot-configuracion.controller';
import { ChatbotConfiguracionService } from './chatbot-configuracion.service';

@Module({
  imports: [ComunModule, AuditoriaModule],
  controllers: [ChatbotConfiguracionController],
  providers: [ChatbotConfiguracionService],
  exports: [ChatbotConfiguracionService],
})
export class ChatbotConfiguracionModule {}
