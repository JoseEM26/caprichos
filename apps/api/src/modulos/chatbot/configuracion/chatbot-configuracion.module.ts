import { Module } from '@nestjs/common';
import { ComunModule } from '../../../comun/comun.module';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { ChatbotConfiguracionController } from './chatbot-configuracion.controller';
import { ChatbotConfiguracionService } from './chatbot-configuracion.service';
import { SpamDesbloqueoController } from './spam-desbloqueo.controller';

@Module({
  imports: [ComunModule, AuditoriaModule],
  controllers: [ChatbotConfiguracionController, SpamDesbloqueoController],
  providers: [ChatbotConfiguracionService],
  exports: [ChatbotConfiguracionService],
})
export class ChatbotConfiguracionModule {}
